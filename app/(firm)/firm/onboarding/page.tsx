import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { customerInvitationRepository as repo } from "@/lib/repositories/customer-invitation.repository";
import {
  deriveCaStage,
  deriveCustomerStage,
  progressPct,
  CA_STAGES,
  CUSTOMER_STAGES,
} from "@/lib/firm/onboarding";
import {
  OnboardingClient,
  type CaOnboardingRow,
  type CustomerOnboardingRow,
  type CaOption,
} from "@/components/firm/onboarding/OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const orgId = user.organizationId;

  const [caInvites, firmUsers, customerInvites] = await Promise.all([
    prisma.invitation.findMany({
      where: { organizationId: orgId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] } },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        profileCompletedAt: true,
        lastLoginAt: true,
        lastActiveAt: true,
        managerId: true,
      },
    }),
    repo.list(orgId),
  ]);

  const userByEmail = new Map(firmUsers.map((u) => [u.email.toLowerCase(), u]));
  const userById = new Map(firmUsers.map((u) => [u.id, u]));

  const caRows: CaOnboardingRow[] = caInvites.map((inv) => {
    const u = userByEmail.get(inv.email.toLowerCase()) ?? null;
    const stage = deriveCaStage(
      { emailOpenedAt: inv.emailOpenedAt, acceptedAt: inv.acceptedAt },
      u
        ? {
            profileCompletedAt: u.profileCompletedAt,
            lastLoginAt: u.lastLoginAt,
            lastActiveAt: u.lastActiveAt,
            isActive: u.isActive,
          }
        : null
    );
    const managerId = inv.managerId ?? u?.managerId ?? null;
    const managerName = managerId ? userById.get(managerId)?.name ?? null : null;
    return {
      id: inv.id,
      name: inv.name ?? inv.email,
      email: inv.email,
      firmRole: inv.firmRole,
      invitationDate: inv.createdAt.toISOString(),
      stage,
      progress: progressPct(stage, CA_STAGES),
      managerName,
      lastActivity: u?.lastActiveAt?.toISOString() ?? null,
    };
  });

  // Live document-upload counts for the DOCUMENTS_UPLOADED signal.
  const custIds = customerInvites.map((i) => i.customerId).filter((x): x is string => !!x);
  const docGroups = custIds.length
    ? await prisma.documentUpload.groupBy({
        by: ["customerId"],
        where: { customerId: { in: custIds } },
        _count: { _all: true },
      })
    : [];
  const docByCustomer = new Map(docGroups.map((d) => [d.customerId, d._count._all]));

  const customerRows: CustomerOnboardingRow[] = customerInvites.map((i) => {
    const stage = deriveCustomerStage({
      status: i.status,
      acceptedAt: i.acceptedAt,
      documentsUploadedAt: i.documentsUploadedAt,
      bankConnectedAt: i.bankConnectedAt,
      completedAt: i.completedAt,
      documentCount: i.customerId ? docByCustomer.get(i.customerId) ?? 0 : 0,
    });
    return {
      id: i.id,
      customerName: i.name ?? i.email,
      businessName: i.company,
      inviteDate: i.createdAt.toISOString(),
      assignedCaName: i.assignedCa?.name ?? i.assignedCa?.email ?? null,
      stage,
      progress: progressPct(stage, CUSTOMER_STAGES),
    };
  });

  const cas: CaOption[] = firmUsers
    .filter((u) => u.isActive)
    .map((u) => ({ id: u.id, name: u.name ?? u.email }));

  return (
    <OnboardingClient caRows={caRows} customerRows={customerRows} cas={cas} />
  );
}
