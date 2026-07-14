import { redirect } from "next/navigation";
import { getTenantId } from "@/lib/auth/tenant";
import { organizationRepository } from "@/lib/repositories";
import { orgBranchRepository, orgDepartmentRepository } from "@/lib/repositories/org-structure.repository";
import { relatedPartyRepository } from "@/lib/repositories/related-party.repository";
import OrganizationSettingsClient from "./OrganizationSettingsClient";

export default async function OrganizationSettingsPage() {
  const organizationId = await getTenantId();
  if (!organizationId) redirect("/sign-in");

  const [{ org, profile, settings }, branches, departments, relatedParties] = await Promise.all([
    organizationRepository.getFullConfig(organizationId),
    orgBranchRepository.list(organizationId),
    orgDepartmentRepository.list(organizationId),
    relatedPartyRepository.list(organizationId),
  ]);
  if (!org) redirect("/sign-in");

  return (
    <OrganizationSettingsClient
      initialData={{
        org: { ...org, createdAt: org.createdAt.toISOString(), plan: org.plan as string },
        profile: profile as Record<string, unknown> | null,
        settings: settings as Record<string, unknown> | null,
        branches,
        departments: departments.map((d) => ({
          ...d,
          headUser: d.headUser ? { id: d.headUser.id, name: d.headUser.name, email: d.headUser.email } : null,
        })),
        relatedParties: relatedParties.map((p) => ({
          ...p,
          shareholdingPercent: p.shareholdingPercent?.toString() ?? null,
        })),
      }}
    />
  );
}
