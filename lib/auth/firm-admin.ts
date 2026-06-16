// ============================================================
// requireFirmAdmin — auth guard for CA Firm Admin pages
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function requireFirmAdmin() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, organizationId: true, userRole: true, role: true },
  });

  if (!user || user.userRole !== "CA_FIRM_ADMIN") redirect("/sign-in");
  return user;
}

export async function requireFirmMember() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, organizationId: true, userRole: true, role: true },
  });

  if (!user || !["CA_FIRM_ADMIN", "CA"].includes(user.userRole ?? "")) redirect("/sign-in");
  return user;
}

/**
 * API-route variant of {@link requireFirmAdmin}: returns the full
 * CA_FIRM_ADMIN user record, or `null` so the caller can respond 401.
 * Centralises the inline `getFirmAdmin()` helper duplicated across the
 * existing /api/firm/* routes.
 */
export async function getFirmAdminApi() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.userRole !== "CA_FIRM_ADMIN") return null;
  return user;
}

/**
 * API-route variant for routes open to any firm member (CA or
 * CA_FIRM_ADMIN), e.g. task collaboration. Returns the full user
 * record, or `null` so the caller can respond 401.
 */
export async function getFirmMemberApi() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || !["CA_FIRM_ADMIN", "CA"].includes(user.userRole ?? "")) return null;
  return user;
}
