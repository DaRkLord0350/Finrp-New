// ============================================================
// /onboarding/plan — plan selection + activation
//
// Shown after profile onboarding completes, for org creators (the
// "Start Your Own Business" / CA-firm path). Dashboard access is gated
// on activation (see dashboard/firm layouts), so this is the last step
// before entering the product. One universal four-tier catalog.
// ============================================================

import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { isOnboardingComplete } from "@/services/onboardingService";
import { getOrgEntitlements } from "@/lib/billing/guards";
import { getActivePlans } from "@/lib/billing/plans";
import { OnboardingPlanSelection } from "@/components/onboarding/OnboardingPlanSelection";

export const metadata = { title: "Choose your plan — FinRP" };

export default async function OnboardingPlanPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (!user.userRole) redirect("/onboarding/welcome");

  // Only CA firms and businesses pick a plan here.
  if (user.userRole === "ADMIN") redirect("/admin");
  if (user.userRole === "CA") redirect("/ca");

  const portalPath = user.userRole === "CA_FIRM_ADMIN" ? "/firm" : "/dashboard";

  // Must finish profile onboarding first.
  const profileDone = await isOnboardingComplete(user.organizationId);
  if (!profileDone) {
    redirect(user.userRole === "CA_FIRM_ADMIN" ? "/onboarding/ca-firm" : "/onboarding/customer");
  }

  // Already activated → straight into the product.
  const ent = await getOrgEntitlements(user.organizationId);
  if (ent.planType && ent.isActive) {
    redirect(portalPath);
  }

  const plans = getActivePlans();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", padding: "0 24px 64px" }}>
      {/* Header */}
      <header style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 48, paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#6366f1,#10b981)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={15} color="white" />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, background: "linear-gradient(135deg,#818cf8,#34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            FinRP
          </span>
        </div>
        <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", textAlign: "center" }}>
          Choose your plan
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-muted)", marginTop: 10, textAlign: "center", maxWidth: 520 }}>
          Start free and upgrade whenever you&apos;re ready. You can change your plan any time from Settings.
        </p>
      </header>

      <main style={{ maxWidth: 1160, margin: "32px auto 0" }}>
        <OnboardingPlanSelection plans={plans} portalPath={portalPath} />
      </main>
    </div>
  );
}
