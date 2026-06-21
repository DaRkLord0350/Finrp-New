"use client";

// ============================================================
// components/billing/BillingPanel.tsx
//
// The Settings → Billing surface (shared by the business dashboard and
// the CA firm portal): current plan, price, status, renewal, feature +
// usage summary, upgrade/downgrade actions (Razorpay for paid plans),
// and billing history with invoice downloads.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  CheckCircle2,
  Download,
  TrendingUp,
  Users2,
  Briefcase,
  FileText,
  UserPlus,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { formatPrice, type PlanDefinition } from "@/lib/billing/plans";
import { FEATURE_LABELS, type Feature } from "@/lib/billing/features";
import type { EntitlementsDTO } from "@/lib/billing/entitlements";
import { PlanCard, type PlanCardCta } from "@/components/pricing/PlanCard";
import { useRazorpayCheckout } from "@/components/billing/useRazorpayCheckout";

export interface BillingHistoryItem {
  id: string;
  planType: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  invoiceNumber: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981",
  TRIALING: "#0ea5e9",
  PAST_DUE: "#f59e0b",
  CANCELED: "#ef4444",
  INACTIVE: "#94a3b8",
};

export function BillingPanel({
  entitlements,
  planName,
  price,
  status,
  renewalDate,
  features,
  usage,
  plans,
  history,
  connectedToCA,
  caName,
}: {
  entitlements: EntitlementsDTO;
  planName: string | null;
  price: number;
  status: string;
  renewalDate: string | null;
  features: Feature[];
  usage: {
    customers: { used: number; limit: number | null };
    invoices: { used: number; limit: number | null };
    team: { used: number; limit: number | null };
    clients: { used: number; limit: number | null } | null;
  };
  plans: PlanDefinition[];
  history: BillingHistoryItem[];
  connectedToCA: boolean;
  caName: string | null;
}) {
  const router = useRouter();
  const { startCheckout, busyPlan } = useRazorpayCheckout();
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  async function changeFree(planType: string) {
    setError(null);
    setNotice(null);
    setActing(planType);
    try {
      const res = await fetch("/api/billing/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not change plan");
      } else {
        setNotice("Plan updated.");
        refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setActing(null);
    }
  }

  function pay(planType: string) {
    setError(null);
    setNotice(null);
    startCheckout(planType, {
      onSuccess: () => {
        setNotice("Payment successful — your plan is active.");
        refresh();
      },
      onError: (m) => setError(m),
      onCancel: () => setError("Payment cancelled."),
    });
  }

  function ctaFor(plan: PlanDefinition): { cta: PlanCardCta; isCurrent: boolean } {
    const isCurrent =
      entitlements.planType === plan.type || entitlements.effectivePlanType === plan.type;
    if (isCurrent) return { cta: { label: "Current plan", variant: "disabled" }, isCurrent: true };

    const upgrade = plan.priceMonthly > price;
    if (plan.priceMonthly === 0) {
      return { cta: { label: `Switch to ${plan.name}`, variant: "ghost", onClick: () => changeFree(plan.type) }, isCurrent: false };
    }
    return { cta: { label: upgrade ? "Upgrade" : `Switch to ${plan.name}`, variant: plan.recommended ? "primary" : "ghost", onClick: () => pay(plan.type) }, isCurrent: false };
  }

  const statusColor = STATUS_COLORS[status] ?? "#94a3b8";
  const onFreePlan = price === 0 && (entitlements.effectivePlanType === "FREE" || entitlements.planType === "FREE" || entitlements.planType === null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Current plan + usage */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <CreditCard size={16} color="#6366f1" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Current plan</h3>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)" }}>{planName ?? "No plan"}</span>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {price === 0 ? "Free" : `${formatPrice(price)}/mo`}
            </span>
            <span style={{ padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, color: statusColor, background: `${statusColor}22` }}>
              {status}
            </span>
          </div>
          {renewalDate && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
              {status === "CANCELED" ? "Access until" : "Renews on"} {new Date(renewalDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
          {connectedToCA && (
            <p style={{ fontSize: 13, color: "#10b981", marginBottom: 14 }}>
              Connected to {caName ?? "your CA"} — Connected plan included free.
            </p>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {features.map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-secondary)" }}>
                <CheckCircle2 size={14} color="#10b981" /> {FEATURE_LABELS[f] ?? f}
              </li>
            ))}
          </ul>
        </div>

        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <TrendingUp size={16} color="#0ea5e9" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Usage</h3>
          </div>
          <UsageBar icon={<Users2 size={14} />} label="Customers" used={usage.customers.used} limit={usage.customers.limit} />
          <UsageBar icon={<FileText size={14} />} label="Invoices" used={usage.invoices.used} limit={usage.invoices.limit} />
          <UsageBar icon={<UserPlus size={14} />} label="Team members" used={usage.team.used} limit={usage.team.limit} />
          {usage.clients && (
            <UsageBar icon={<Briefcase size={14} />} label="Active clients" used={usage.clients.used} limit={usage.clients.limit} />
          )}
        </div>
      </div>

      {/* Upgrade nudge for Free orgs */}
      {onFreePlan && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.1))",
            border: "1px solid rgba(99,102,241,0.3)",
          }}
        >
          <Sparkles size={18} color="#6366f1" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Upgrade your plan</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Unlock AI features, integrations, more customers, invoices and team members.
            </p>
          </div>
          <a href="#change-plan" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
            See plans <ArrowUpRight size={15} />
          </a>
        </div>
      )}

      {notice && <Banner color="#10b981" msg={notice} />}
      {error && <Banner color="#ef4444" msg={error} />}

      {/* Change plan */}
      <div id="change-plan" style={{ scrollMarginTop: 80 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Change plan</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Upgrades take effect immediately. Your existing data is always preserved.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, alignItems: "stretch" }}>
          {plans.map((plan) => {
            const { cta, isCurrent } = ctaFor(plan);
            return <PlanCard key={plan.type} plan={plan} cta={cta} isCurrent={isCurrent} busy={acting === plan.type || busyPlan === plan.type} />;
          })}
        </div>
      </div>

      {/* History */}
      <div className="section-card">
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Billing history</h3>
        {history.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>No payments yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Date", "Plan", "Amount", "Status", "Invoice"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td style={tdStyle}>{new Date(h.createdAt).toLocaleDateString("en-IN")}</td>
                    <td style={tdStyle}>{h.planType.replace(/_/g, " ")}</td>
                    <td style={tdStyle}>{formatPrice(h.amount)}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: h.status === "CAPTURED" ? "#10b981" : h.status === "FAILED" ? "#ef4444" : "#f59e0b" }}>
                        {h.status === "CAPTURED" ? "Paid" : h.status[0] + h.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {h.status === "CAPTURED" && h.invoiceNumber ? (
                        <a href={`/api/billing/invoice/${h.id}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#6366f1", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                          <Download size={14} /> {h.invoiceNumber}
                        </a>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function UsageBar({ icon, label, used, limit }: { icon: React.ReactNode; label: string; used: number; limit: number | null }) {
  const pct = limit && limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const over = limit !== null && used >= limit;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>{icon} {label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{used}/{limit === null ? "∞" : limit}</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: "var(--bg-elevated)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: limit === null ? "10%" : `${pct}%`, background: over ? "#ef4444" : "#0ea5e9", opacity: limit === null ? 0.35 : 1, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function Banner({ color, msg }: { color: string; msg: string }) {
  return (
    <p style={{ padding: "10px 16px", borderRadius: 10, background: `${color}1a`, border: `1px solid ${color}55`, color, fontSize: 13 }}>{msg}</p>
  );
}

const thStyle: React.CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", borderBottom: "1px solid var(--border)" };
const tdStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 13, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" };
