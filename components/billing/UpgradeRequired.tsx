// ============================================================
// components/billing/UpgradeRequired.tsx
//
// Friendly "this feature needs a higher plan" screen, shown in place of
// a page whose plan entitlement the current org lacks. Used by server
// pages that would otherwise return a 402 from their data calls.
// ============================================================

import Link from "next/link";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { FEATURE_LABELS, type Feature } from "@/lib/billing/features";

export function UpgradeRequired({
  feature,
  title,
  description,
  /** Where the upgrade CTA points (firm portal uses /firm/billing). */
  billingHref = "/settings/billing",
}: {
  feature?: Feature;
  title?: string;
  description?: string;
  billingHref?: string;
}) {
  const featureLabel = feature ? FEATURE_LABELS[feature] ?? feature : "This feature";

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "48px auto",
        padding: "40px 32px",
        textAlign: "center",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 20,
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 16,
          margin: "0 auto 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(16,185,129,0.12))",
          border: "1px solid rgba(99,102,241,0.3)",
        }}
      >
        <Lock size={26} color="#6366f1" />
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 10 }}>
        {title ?? `${featureLabel} is a premium feature`}
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 26, maxWidth: 420, marginInline: "auto" }}>
        {description ??
          `${featureLabel} isn't included in your current plan. Upgrade to unlock it — your existing data stays exactly as it is.`}
      </p>

      <Link
        href={billingHref}
        className="btn-brand"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", fontSize: 14, fontWeight: 700 }}
      >
        <Sparkles size={16} /> View upgrade options <ArrowRight size={16} />
      </Link>
    </div>
  );
}
