// ============================================================
// lib/auth/permission-resolver.ts
//
// SERVER-ONLY. Resolves the EFFECTIVE permission list for an
// (organization, role) pair:
//
//   • OWNER                     → always ["*"]  (never customizable)
//   • org has RolePermission    → expand those CRUD rows into the
//     rows for this role           flat <resource>.<action> list
//   • otherwise (no rows)       → static code defaults (permissionsFor)
//
// This is what makes custom roles work WITHOUT code changes while
// staying 100% backward compatible: an org with no overrides behaves
// exactly like the static matrix.
//
// Result is cached in Redis (CacheKey.rolePerms). Any write to the
// RolePermission table MUST call invalidatePermissionsCache(org) so
// the change takes effect on the next request (see settings/roles API).
// ============================================================

import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheDel, cacheDelPattern, CacheKey, TTL } from "@/lib/cache";
import { permissionsFor, crudToPermissions, type AppModule } from "./rbac";

/**
 * Effective permission strings for a role within an organization.
 * Falls back to the static matrix when the org has no custom rows.
 */
export async function resolvePermissions(
  organizationId: string,
  role: Role | null | undefined
): Promise<string[]> {
  if (!role) return [];

  // OWNER is intentionally non-customizable — always full access.
  if (role === "OWNER") return ["*"];

  const cacheKey = CacheKey.rolePerms(organizationId, role);
  const cached = await cacheGet<string[]>(cacheKey);
  if (cached) return cached;

  const rows = await prisma.rolePermission.findMany({
    where: { organizationId, role },
    select: {
      module: true,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    },
  });

  // No overrides for this org+role → static code defaults.
  const resolved =
    rows.length === 0
      ? permissionsFor(role)
      : Array.from(
          new Set(
            rows.flatMap((r) =>
              crudToPermissions(r.module as AppModule, {
                view: r.canView,
                create: r.canCreate,
                edit: r.canEdit,
                delete: r.canDelete,
              })
            )
          )
        );

  await cacheSet(cacheKey, resolved, TTL.ROLE_PERMS);
  return resolved;
}

/**
 * Bust the resolved-permission cache after a RolePermission change.
 * Pass a role to target one mapping, or omit to clear all roles in the org.
 */
export async function invalidatePermissionsCache(
  organizationId: string,
  role?: Role
): Promise<void> {
  if (role) {
    await cacheDel(CacheKey.rolePerms(organizationId, role));
  } else {
    await cacheDelPattern(CacheKey.rolePermsPattern(organizationId));
  }
}
