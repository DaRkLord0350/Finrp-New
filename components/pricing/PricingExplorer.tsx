"use client";

// ============================================================
// components/pricing/PricingExplorer.tsx
//
// Drives the pricing page: a single universal four-tier grid (Free /
// Starter / Growth / Enterprise). The CTA on each card is derived from
// the viewer's auth + current plan. Free activates instantly; paid tiers
// go through Razorpay checkout.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanDefinition } from "@/lib/billing/plans";
import type { EntitlementsDTO } from "@/lib/billing/entitlements";
import { PlanCard, type PlanCardCta } from "./PlanCard";
import { useRazorpayCheckout } from "@/components/billing/useRazorpayCheckout";

export function PricingExplorer({
  plans,
  isAuthed,
  entitlements,
  connectedToCA,
  caName,
}: {
  plans: PlanDefinition[];
  isAuthed: boolean;
  entitlements: EntitlementsDTO | null;
  connectedToCA: boolean;
  caName: string | null;
}) {
  const router = useRouter();
  const { startCheckout, busyPlan: payingPlan } = useRazorpayCheckout();
  const [changing, setChanging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Free target (e.g. downgrade) → activate via the plan API.
  async function changeFreePlan(planType: string) {
    setError(null);
    setChanging(planType);
    try {
      const res = await fetch("/api/billing/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not change plan");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setChanging(null);
    }
  }

  // Paid plans go through Razorpay checkout; free plans activate immediately.
  function purchase(plan: PlanDefinition) {
    setError(null);
    if (plan.priceMonthly === 0) {
      void changeFreePlan(plan.type);
      return;
    }
    startCheckout(plan.type, {
      onSuccess: () => router.refresh(),
      onError: (m) => setError(m),
      onCancel: () => setError("Payment cancelled — you can try again."),
    });
  }

  const busyPlan = changing ?? payingPlan;

  function deriveCta(plan: PlanDefinition): { cta: PlanCardCta; isCurrent: boolean } {
    // Logged-out marketing view.
    if (!isAuthed || !entitlements) {
      return {
        cta: {
          label: plan.priceMonthly === 0 ? "Get started" : "Start now",
          variant: plan.recommended ? "primary" : "ghost",
          href: "/sign-up",
        },
        isCurrent: false,
      };
    }

    const ent = entitlements;
    const isCurrent = ent.planType === plan.type || ent.effectivePlanType === plan.type;
    if (isCurrent) {
      return { cta: { label: "Current plan", variant: "disabled" }, isCurrent: true };
    }

    const currentPrice = currentPlanPrice(ent, plans);
    const upgrade = plan.priceMonthly > currentPrice;
    return {
      cta: {
        label: plan.priceMonthly === 0 ? "Switch to Free" : upgrade ? "Upgrade" : `Switch to ${plan.name}`,
        variant: plan.recommended ? "primary" : "ghost",
        onClick: () => purchase(plan),
      },
      isCurrent: false,
    };
  }

  return (
    <div>
      {/* Connected banner (informational) */}
      {connectedToCA && (
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto 28px",
            padding: "12px 18px",
            borderRadius: 12,
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "#10b981",
            fontSize: 14,
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          You&apos;re connected to {caName ?? "your CA"}. You can manage your plan below at any time.
        </div>
      )}

      {error && (
        <p
          style={{
            maxWidth: 720,
            margin: "0 auto 18px",
            padding: "10px 16px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#ef4444",
            fontSize: 13,
            textAlign: "center",
          }}
        >
          {error}
        </p>
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
        {plans.map((plan) => {
          const { cta, isCurrent } = deriveCta(plan);
          return (
            <PlanCard
              key={plan.type}
              plan={plan}
              cta={cta}
              isCurrent={isCurrent}
              busy={busyPlan === plan.type}
            />
          );
        })}
      </div>
    </div>
  );
}

function currentPlanPrice(ent: EntitlementsDTO, all: PlanDefinition[]): number {
  const current = all.find((p) => p.type === ent.effectivePlanType || p.type === ent.planType);
  return current?.priceMonthly ?? 0;
}
