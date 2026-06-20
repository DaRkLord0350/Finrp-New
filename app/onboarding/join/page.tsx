// ============================================================
// /onboarding/join — "Join via CA Invitation" path.
// Joins the inviter's organization as a member; no plan/payment.
// ============================================================

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { JoinInvitation } from "@/components/onboarding/JoinInvitation";

export const metadata = { title: "Join via invitation — FinRP" };

export default async function OnboardingJoinPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");

  // Users who already have a role belong in the smart router, not here.
  if (user.userRole) redirect("/onboarding");

  return <JoinInvitation email={user.email} />;
}
