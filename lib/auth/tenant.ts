import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheDel, CacheKey, TTL } from "@/lib/cache";

/**
 * Returns the DB organizationId for the current Clerk user.
 * Result is cached in Redis for TTL.TENANT_ID seconds so subsequent
 * API routes in the same request window skip the DB round-trip.
 *
 * Invalidate after role change or org switch: invalidateTenantCache(clerkId)
 */
export async function getTenantId(): Promise<string | null> {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  // Redis cache hit → no DB call
  const cached = await cacheGet<string>(CacheKey.tenant(userId));
  if (cached) return cached;

  // DB lookup — select only the one field we need
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { organizationId: true },
  });

  if (dbUser?.organizationId) {
    // Cache for next requests
    await cacheSet(CacheKey.tenant(userId), dbUser.organizationId, TTL.TENANT_ID);
    return dbUser.organizationId;
  }

  // Fallback (Clerk org or userId — handled by legacy callers)
  return orgId ?? userId;
}

/**
 * Call this whenever the user's organization changes (role switch, re-onboard).
 * Forces the next API call to re-read from DB.
 */
export async function invalidateTenantCache(clerkId: string): Promise<void> {
  await cacheDel(CacheKey.tenant(clerkId), CacheKey.user(clerkId));
}
