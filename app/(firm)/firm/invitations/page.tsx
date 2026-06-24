import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getTeamRoster } from "@/lib/team/queries";
import { customerInvitationRepository as repo } from "@/lib/repositories/customer-invitation.repository";
import {
  FirmInvitationsClient,
  type CustomerInviteRow,
  type CaInviteRow,
  type CaOption,
} from "@/components/firm/invitations/FirmInvitationsClient";

export default async function FirmInvitationsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const [roster, invitations, funnel] = await Promise.all([
    getTeamRoster(user.organizationId),
    repo.list(user.organizationId),
    repo.funnel(user.organizationId),
  ]);

  const customerRows: CustomerInviteRow[] = invitations.map((i) => ({
    id: i.id,
    email: i.email,
    name: i.name,
    company: i.company,
    status: i.status,
    invitedByName: i.invitedBy?.name ?? i.invitedBy?.email ?? null,
    assignedCaName: i.assignedCa?.name ?? i.assignedCa?.email ?? null,
    resendCount: i.resendCount,
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt.toISOString(),
    sentAt: i.sentAt?.toISOString() ?? null,
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
  }));

  // CA / team invitations (Invitation table, via the shared roster model).
  const caInvites: CaInviteRow[] = roster.invites.map((inv) => ({
    id: inv.id,
    email: inv.email,
    name: inv.name,
    firmRole: inv.firmRole,
    status: inv.status,
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
  }));

  // Active CAs available to own a customer relationship.
  const cas: CaOption[] = roster.members
    .filter((m) => m.isActive && (m.userRole === "CA" || m.userRole === "CA_FIRM_ADMIN"))
    .map((m) => ({ id: m.id, name: m.name ?? m.email }));

  const activeCaCount = cas.length;

  return (
    <FirmInvitationsClient
      customerInvites={customerRows}
      customerFunnel={funnel}
      caInvites={caInvites}
      activeCaCount={activeCaCount}
      cas={cas}
    />
  );
}
