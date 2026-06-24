import { redirect } from "next/navigation";
import { getTenantId } from "@/lib/auth/tenant";
import { getIntegrationHealthSnapshot } from "@/lib/integrations/health";
import IntegrationHealthClient from "./IntegrationHealthClient";

export const metadata = { title: "Integration Health — FinRP" };

export default async function IntegrationHealthPage() {
  const organizationId = await getTenantId();
  if (!organizationId) redirect("/sign-in");

  const rows = await getIntegrationHealthSnapshot(organizationId);

  const serialized = rows.map((r) => ({
    ...r,
    lastSyncAt: r.lastSyncAt ? r.lastSyncAt.toISOString() : null,
  }));

  return <IntegrationHealthClient rows={serialized} />;
}
