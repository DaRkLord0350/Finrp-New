// ============================================================
// /advisor — plan gate (AI feature).
// The advisor page is a client component, so the entitlement check lives
// in this server layout: it renders an upgrade screen instead of the
// chat when the plan doesn't include AI.
// ============================================================

import { currentHasFeature } from "@/lib/billing/guards";
import { FEATURES } from "@/lib/billing/features";
import { UpgradeRequired } from "@/components/billing/UpgradeRequired";

export default async function AdvisorLayout({ children }: { children: React.ReactNode }) {
  if (!(await currentHasFeature(FEATURES.AI))) {
    return <UpgradeRequired feature={FEATURES.AI} title="The AI Advisor needs a higher plan" />;
  }
  return <>{children}</>;
}
