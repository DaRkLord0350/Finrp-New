"use client";

// ============================================================
// components/pricing/PlanCard.tsx
//
// A single pricing card. Pure presentation + a CTA whose behaviour is
// decided by the parent (PricingExplorer) and passed in as `cta`.
// ============================================================

import { Check, Lock, Sparkles } from "lucide-react";
import { formatPrice, type PlanDefinition } from "@/lib/billing/plans";

export interface PlanCardCta {
  label: string;
  /** Visual intent. */
  variant: "primary" | "ghost" | "disabled" | "included";
  onClick?: () => void;
  href?: string;
}

export function PlanCard({
  plan,
  cta,
  isCurrent,
  busy,
}: {
  plan: PlanDefinition;
  cta: PlanCardCta;
  isCurrent?: boolean;
  busy?: boolean;
}) {
  const highlighted = plan.recommended;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        padding: 24,
        background: "var(--bg-surface)",
        border: `1px solid ${highlighted ? "#6366f1" : "var(--border)"}`,
        boxShadow: highlighted ? "0 12px 40px -12px rgba(99,102,241,0.45)" : "none",
        minHeight: 420,
      }}
    >
      {highlighted && (
        <div
          style={{
            position: "absolute",
            top: -11,
            left: 24,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 10px",
            borderRadius: 99,
            background: "linear-gradient(135deg,#6366f1,#4f46e5)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          <Sparkles size={12} /> Most popular
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{plan.name}</h3>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, minHeight: 34 }}>
          {plan.tagline}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 34, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {plan.priceMonthly === 0 ? "Free" : formatPrice(plan.priceMonthly)}
        </span>
        {plan.priceMonthly > 0 && (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/month</span>
        )}
      </div>

      {/* Universal limits line */}
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
        {plan.customerLimit === null ? "Unlimited customers" : `${plan.customerLimit.toLocaleString("en-IN")} customers`}
        {" · "}
        {plan.invoiceLimit === null ? "unlimited invoices" : `${plan.invoiceLimit.toLocaleString("en-IN")} invoices`}
        {" · "}
        {plan.teamLimit === null ? "unlimited team" : `${plan.teamLimit} team`}
      </p>
      <p style={{ fontSize: 12, fontWeight: 600, color: plan.ai ? "#10b981" : "var(--text-muted)", marginBottom: 16 }}>
        {plan.ai ? "✓ AI features included" : "AI features not included"}
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 20px", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {plan.highlights.map((h) => (
          <li key={h} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            <Check size={15} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{h}</span>
          </li>
        ))}
      </ul>

      <CtaButton cta={cta} busy={busy} isCurrent={isCurrent} />
    </div>
  );
}

function CtaButton({ cta, busy, isCurrent }: { cta: PlanCardCta; busy?: boolean; isCurrent?: boolean }) {
  const base: React.CSSProperties = {
    width: "100%",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    textAlign: "center",
    textDecoration: "none",
    border: "1px solid transparent",
    cursor: cta.variant === "disabled" || cta.variant === "included" ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };

  const styles: Record<PlanCardCta["variant"], React.CSSProperties> = {
    primary: { ...base, background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff" },
    ghost: { ...base, background: "transparent", color: "var(--text-primary)", borderColor: "var(--border)" },
    disabled: { ...base, background: "var(--bg-elevated)", color: "var(--text-muted)" },
    included: { ...base, background: "rgba(16,185,129,0.12)", color: "#10b981", borderColor: "rgba(16,185,129,0.3)" },
  };

  const label = busy ? "Working…" : cta.label;
  const content = (
    <>
      {cta.variant === "included" && <Check size={15} />}
      {cta.variant === "disabled" && isCurrent !== true && <Lock size={14} />}
      {label}
    </>
  );

  if (cta.href && cta.variant !== "disabled" && cta.variant !== "included") {
    return (
      <a href={cta.href} style={styles[cta.variant]}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      disabled={busy || cta.variant === "disabled" || cta.variant === "included" || !cta.onClick}
      onClick={cta.onClick}
      style={styles[cta.variant]}
    >
      {content}
    </button>
  );
}
