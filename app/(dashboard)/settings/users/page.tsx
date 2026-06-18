import { redirect } from "next/navigation";
import { getTenantId } from "@/lib/auth/tenant";
import { guardModule } from "@/lib/auth/require-module";
import { prisma } from "@/lib/prisma";
import UsersSettingsClient from "./UsersSettingsClient";

export default async function UsersSettingsPage() {
  // Only OWNER/ADMIN manage users (defense-in-depth on top of the
  // settings-area guard + the API-level checks).
  const denied = await guardModule("users");
  if (denied) return denied;

  const organizationId = await getTenantId();
  if (!organizationId) redirect("/sign-in");

  const [members, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true, name: true, email: true, designation: true, department: true,
        role: true, avatarUrl: true, isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <UsersSettingsClient
      initialMembers={members.map((m) => ({
        ...m,
        name: m.name ?? null,
        designation: m.designation ?? null,
        department: m.department ?? null,
        avatarUrl: m.avatarUrl ?? null,
        lastLoginAt: m.lastLoginAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      }))}
      initialInvitations={invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role as "OWNER" | "ADMIN" | "MANAGER" | "ACCOUNTANT" | "STAFF" | "VIEWER",
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
      }))}
    />
  );
}
