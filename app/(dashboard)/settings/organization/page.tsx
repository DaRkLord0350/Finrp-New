import { redirect } from "next/navigation";
import { getTenantId } from "@/lib/auth/tenant";
import { organizationRepository } from "@/lib/repositories";
import OrganizationSettingsClient from "./OrganizationSettingsClient";

export default async function OrganizationSettingsPage() {
  const organizationId = await getTenantId();
  if (!organizationId) redirect("/sign-in");

  const { org, profile, settings } = await organizationRepository.getFullConfig(organizationId);
  if (!org) redirect("/sign-in");

  return (
    <OrganizationSettingsClient
      initialData={{
        org: { ...org, createdAt: org.createdAt.toISOString(), plan: org.plan as string },
        profile: profile as Record<string, unknown> | null,
        settings: settings as Record<string, unknown> | null,
      }}
    />
  );
}
