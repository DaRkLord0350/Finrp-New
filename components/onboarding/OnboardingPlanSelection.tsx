"use client";

// ============================================================
// components/onboarding/OnboardingPlanSelection.tsx
//
// The plan-selection + activation step shown after profile onboarding,
// for org creators (the "Start Your Own Business" / CA-firm path).
// One universal four-tier catalog:
//   • Free        → activates instantly (no payment) via /activate-free.
//   • Starter/…   → Razorpay checkout → server /verify → dashboard.
//
// The Free tier is presented prominently with a "Continue Free" CTA.
// On activation the user is taken straight into their portal.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";
import type { PlanDefinition } from "@/lib/billing/plans";
import { PlanCard, type PlanCardCta } from "@/components/pricing/PlanCard";
import { useRazorpayCheckout } from "@/components/billing/useRazorpayCheckout";

export function OnboardingPlanSelection({
  plans,
  portalPath,
}: {
  plans: PlanDefinition[];
  /** Where to land after activation ("/firm" or "/dashboard"). */
  portalPath: string;
}) {
  const router = useRouter();
  const { startCheckout, busyPlan } = useRazorpayCheckout();
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function goToPortal() {
    router.push(portalPath);
    router.refresh();
  }

  async function activateFree(planType: string) {
    setError(null);
    setActing(planType);
    try {
      const res = await fetch("/api/billing/activate-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not activate plan");
        setActing(null);
        return;
      }
      goToPortal();
    } catch {
      setError("Network error");
      setActing(null);
    }
  }

  // Paid plans: only land in the portal AFTER server-side verification.
  function pay(planType: string) {
    setError(null);
    startCheckout(planType, {
      onSuccess: () => goToPortal(),
      onError: (m) => setError(m),
      onCancel: () => setError("Payment cancelled — you can try again."),
    });
  }

  function ctaFor(plan: PlanDefinition): PlanCardCta {
    const busy = acting === plan.type || busyPlan === plan.type;
    if (plan.priceMonthly === 0) {
      return {
        label: busy ? "Activating…" : "Continue Free",
        variant: "primary",
        onClick: () => activateFree(plan.type),
      };
    }
    return {
      label: busy ? "Processing…" : `Choose ${plan.name}`,
      variant: plan.recommended ? "primary" : "ghost",
      onClick: () => pay(plan.type),
    };
  }

  const freePlan = plans.find((p) => p.priceMonthly === 0);

  return (
    <div>
      {error && <ErrorLine msg={error} />}

      {/* Prominent "Continue Free" rail */}
      {freePlan && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 14,
            maxWidth: 1120,
            margin: "0 auto 24px",
            padding: "16px 20px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(16,185,129,0.08))",
            border: "1px solid rgba(99,102,241,0.3)",
          }}
        >
          <Sparkles size={20} color="#6366f1" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              Start free — no credit card required
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Up to {freePlan.customerLimit} customers and {freePlan.invoiceLimit} invoices. Upgrade any time.
            </p>
          </div>
          <button
            className="btn-brand"
            onClick={() => activateFree(freePlan.type)}
            disabled={acting === freePlan.type}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "11px 20px", fontWeight: 700 }}
          >
            {acting === freePlan.type ? "Activating…" : "Continue Free"} <ArrowRight size={16} />
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          maxWidth: 1120,
          margin: "0 auto",
          alignItems: "stretch",
        }}
      >
        {plans.map((plan) => (
          <PlanCard
            key={plan.type}
            plan={plan}
            cta={ctaFor(plan)}
            busy={acting === plan.type || busyPlan === plan.type}
          />
        ))}
      </div>
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <p style={{ maxWidth: 720, margin: "0 auto 18px", padding: "10px 16px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13, textAlign: "center" }}>
      {msg}
    </p>
  );
}
