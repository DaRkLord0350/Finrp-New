// ============================================================
// /api/settings/roles — custom per-organization role permissions
//
// GET  — code-default CRUD matrix + this org's override rows
// PUT  — upsert override rows for one role  { role, modules: [...] }
// DELETE ?role=ROLE — clear overrides for a role (revert to defaults)
//
// Guarded by `users.manage`. OWNER is immutable (always full access).
// Every change busts the resolved-permission cache so it takes effect
// on the next request, and is written to the audit log.
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { canFromList, getModuleMatrix, ALL_MODULES } from "@/lib/auth/rbac";
import {
  resolvePermissions,
  invalidatePermissionsCache,
} from "@/lib/auth/permission-resolver";
import { createAuditLog } from "@/lib/audit";
import { Role, type Prisma } from "@prisma/client";

// Roles an owner/admin may customize (OWNER is intentionally excluded).
const EDITABLE_ROLES: Role[] = [
  Role.ADMIN,
  Role.MANAGER,
  Role.ACCOUNTANT,
  Role.STAFF,
  Role.VIEWER,
];

const MODULE_SET = new Set<string>(ALL_MODULES);

async function authorize() {
  const { userId } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const organizationId = await getTenantId();
  if (!organizationId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!actor) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const perms = await resolvePermissions(actor.organizationId, actor.role);
  if (!canFromList(perms, "users.manage")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { organizationId, actor };
}

export async function GET() {
  try {
    const ctx = await authorize();
    if ("error" in ctx) return ctx.error;

    const overrides = await prisma.rolePermission.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: [{ role: "asc" }, { module: "asc" }],
    });

    // Code defaults per editable role (for the UI to show + diff against).
    const defaults = Object.fromEntries(
      EDITABLE_ROLES.map((r) => [r, getModuleMatrix(r)])
    );

    return NextResponse.json({ modules: ALL_MODULES, defaults, overrides });
  } catch (error) {
    console.error("[SETTINGS_ROLES_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await authorize();
    if ("error" in ctx) return ctx.error;

    const body = await req.json();
    const role = body?.role as Role;
    const modules = body?.modules as Array<{
      module: string;
      canView?: boolean;
      canCreate?: boolean;
      canEdit?: boolean;
      canDelete?: boolean;
    }>;

    if (!EDITABLE_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid or non-editable role (OWNER cannot be customized)" },
        { status: 400 }
      );
    }
    if (!Array.isArray(modules) || modules.length === 0) {
      return NextResponse.json({ error: "modules array required" }, { status: 400 });
    }
    for (const m of modules) {
      if (!MODULE_SET.has(m.module)) {
        return NextResponse.json({ error: `Unknown module: ${m.module}` }, { status: 400 });
      }
    }

    await prisma.$transaction(
      modules.map((m) =>
        prisma.rolePermission.upsert({
          where: {
            organizationId_role_module: {
              organizationId: ctx.organizationId,
              role,
              module: m.module,
            },
          },
          create: {
            organizationId: ctx.organizationId,
            role,
            module: m.module,
            canView: !!m.canView,
            canCreate: !!m.canCreate,
            canEdit: !!m.canEdit,
            canDelete: !!m.canDelete,
          },
          update: {
            canView: !!m.canView,
            canCreate: !!m.canCreate,
            canEdit: !!m.canEdit,
            canDelete: !!m.canDelete,
          },
        })
      )
    );

    await invalidatePermissionsCache(ctx.organizationId, role);

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.actor.id,
      action: "SETTINGS_CHANGE",
      entity: "role_permissions",
      entityId: role,
      description: `Updated custom permissions for role ${role}`,
      newValue: modules as unknown as Prisma.InputJsonValue,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SETTINGS_ROLES_PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await authorize();
    if ("error" in ctx) return ctx.error;

    const role = new URL(req.url).searchParams.get("role") as Role | null;
    if (!role || !EDITABLE_ROLES.includes(role)) {
      return NextResponse.json({ error: "Valid role query param required" }, { status: 400 });
    }

    await prisma.rolePermission.deleteMany({
      where: { organizationId: ctx.organizationId, role },
    });
    await invalidatePermissionsCache(ctx.organizationId, role);

    await createAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.actor.id,
      action: "SETTINGS_CHANGE",
      entity: "role_permissions",
      entityId: role,
      description: `Reverted role ${role} to default permissions`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SETTINGS_ROLES_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
