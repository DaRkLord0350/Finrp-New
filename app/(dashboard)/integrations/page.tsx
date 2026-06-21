import { redirect } from "next/navigation";
import { getTenantId } from "@/lib/auth/tenant";
import { currentHasFeature } from "@/lib/billing/guards";
import { FEATURES } from "@/lib/billing/features";
import { UpgradeRequired } from "@/components/billing/UpgradeRequired";
import { integrationRepository } from "@/lib/repositories";
import IntegrationsClient from "./IntegrationsClient";

export default async function IntegrationsPage() {
  const organizationId = await getTenantId();
  if (!organizationId) redirect("/sign-in");

  // Plan gate: Integrations is a premium feature — show an upgrade screen
  // instead of letting connect/sync calls fail with a 402.
  if (!(await currentHasFeature(FEATURES.INTEGRATIONS))) {
    return <UpgradeRequired feature={FEATURES.INTEGRATIONS} />;
  }

  const integrations = await integrationRepository.list(organizationId);

  const connected = integrations.map((i: Record<string, unknown>) => ({
    id: i.id as string,
    type: i.type as string,
    status: i.status as string,
    name: i.name as string,
    lastSyncAt: i.lastSyncAt ? String(i.lastSyncAt) : null,
  }));

  return <IntegrationsClient initialConnected={connected} />;
}
