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
