// ============================================================
// Tenant Guard — enforces organizationId on all DB operations
//
// Use this module to audit and enforce multi-tenant isolation.
//
// Anti-patterns detected:
//   • Query without organizationId where clause
//   • Cross-tenant data access
//   • Missing tenant validation in API routes
//
// Usage:
//   import { assertSameTenant } from "@/lib/auth/tenant-guard";
//
//   // In route handlers that load a resource by ID:
//   assertSameTenant(resource.organizationId, organizationId);
// ============================================================

export class TenantMismatchError extends Error {
  readonly status = 403;
  constructor(message = "Access denied: resource belongs to another organization") {
    super(message);
    this.name = "TenantMismatchError";
  }
}

/**
 * Throws TenantMismatchError if resourceOrgId !== requestOrgId.
 * Use in route handlers when loading a resource by ID to prevent
 * users from accessing another tenant's data via IDOR.
 *
 * @example
 * const invoice = await prisma.invoice.findUnique({ where: { id } });
 * assertSameTenant(invoice?.organizationId, organizationId);
 */
export function assertSameTenant(
  resourceOrgId: string | null | undefined,
  requestOrgId: string
): void {
  if (!resourceOrgId || resourceOrgId !== requestOrgId) {
    throw new TenantMismatchError();
  }
}

/**
 * Returns true if the resource belongs to the requesting organization.
 * Non-throwing version for conditional checks.
 */
export function isSameTenant(
  resourceOrgId: string | null | undefined,
  requestOrgId: string
): boolean {
  return resourceOrgId === requestOrgId;
}

/**
 * Builds a Prisma `where` clause fragment that ALWAYS includes organizationId.
 * Centralises the pattern to prevent accidental omission.
 *
 * @example
 * const items = await prisma.invoice.findMany({
 *   where: { ...tenantWhere(organizationId), status: "OVERDUE" }
 * });
 */
export function tenantWhere(organizationId: string) {
  return { organizationId } as const;
}

/**
 * Tenant-scoped ID lookup that returns null (not throws) on mismatch.
 * Safe for use in GET /resource/[id] routes.
 */
export function scopeId(id: string, organizationId: string) {
  return { id, organizationId } as const;
}

/**
 * Load a tenant-owned resource by id, scoped to the organization in ONE
 * query — the safe replacement for `findUnique({ where: { id } })`, which
 * can leak across tenants (IDOR). Returns null when the id doesn't exist
 * OR belongs to another org (callers should 404 in both cases).
 *
 * @example
 * const invoice = await findByIdInOrg(prisma.invoice, id, organizationId);
 * if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
 */
export async function findByIdInOrg<T>(
  model: {
    findFirst: (args: {
      where: { id: string; organizationId: string };
    }) => Promise<T | null>;
  },
  id: string,
  organizationId: string
): Promise<T | null> {
  return model.findFirst({ where: { id, organizationId } });
}
