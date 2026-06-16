import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getTeamRoster } from "@/lib/team/queries";
import { TeamClient } from "@/components/firm/team/TeamClient";

export default async function FirmTeamPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const { members, invites, activity } = await getTeamRoster(user.organizationId);

  return (
    <TeamClient
      initialMembers={members}
      initialInvites={invites}
      initialActivity={activity}
    />
  );
}
