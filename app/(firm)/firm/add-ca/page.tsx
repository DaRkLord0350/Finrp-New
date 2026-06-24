import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getTeamRoster } from "@/lib/team/queries";
import { AddCaWizard } from "@/components/firm/onboarding/AddCaWizard";

export const dynamic = "force-dynamic";

export default async function AddCaPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const { members } = await getTeamRoster(user.organizationId);

  // Any active member can be a reporting manager.
  const managers = members
    .filter((m) => m.isActive)
    .map((m) => ({ id: m.id, name: m.name ?? m.email, role: m.firmRole }));

  return <AddCaWizard managers={managers} />;
}
