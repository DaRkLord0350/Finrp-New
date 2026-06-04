// ============================================================
// lib/auth/session.ts
//
// ARCHITECTURE:
//   readCurrentUser()      — read-only; returns null if not in DB
//   getCurrentUser()       — read or auto-provision; never returns null
//   getOptionalUser()      — getCurrentUser wrapped in try/catch
//   invalidateUserCache()  — bust Redis cache after mutations
//
// PROVISIONING SAFETY:
//   1. Redis distributed lock serializes concurrent signups for the
//      same clerkId so only one transaction ever reaches the DB.
//   2. Double-check after acquiring the lock; bail early if another
//      instance already provisioned.
//   3. Catch P2002 (unique constraint on clerkId) as a final safety
//      net if the lock is unavailable (Redis down) and two transactions
//      race to completion — the loser re-reads the winner's user.
//   4. The whole provisioning path (org + user + membership) is inside
//      a single Prisma $transaction, so if user.create fails the org
//      is rolled back — no orphan organizations.
// ============================================================

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { cacheGet, cacheSet, cacheDel, CacheKey, TTL } from "@/lib/cache";
import { acquireLock, releaseLock } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Return type — explicit Prisma payload to avoid circular type inference
// ---------------------------------------------------------------------------
type CurrentUserPayload = Prisma.UserGetPayload<{
  include: { organization: { include: { businessProfile: true } } };
}> | null;

// ---------------------------------------------------------------------------
// Shared slug generator
// ---------------------------------------------------------------------------
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ---------------------------------------------------------------------------
// DB fetch — select only what we need for the session payload
// ---------------------------------------------------------------------------
async function fetchUserFromDb(clerkId: string): Promise<CurrentUserPayload> {
  return prisma.user.findUnique({
    where: { clerkId },
    include: {
      organization: {
        include: { businessProfile: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// readCurrentUser
//
// PURE READ — never creates data.
// Use this in:
//   • API route guards (requireAuth)
//   • Layouts that only need to check role
//   • Any helper that must NOT trigger provisioning
//
// Returns null when the Clerk user exists but hasn't been provisioned yet.
// ---------------------------------------------------------------------------
export async function readCurrentUser(): Promise<CurrentUserPayload> {
  const { userId } = await auth();
  if (!userId) return null;

  const cached = await cacheGet<CurrentUserPayload>(CacheKey.user(userId));
  if (cached) return cached;

  const existing = await fetchUserFromDb(userId);
  if (existing) {
    await cacheSet(CacheKey.user(userId), existing, TTL.USER_SESSION);
  }
  return existing;
}

// ---------------------------------------------------------------------------
// getCurrentUser
//
// READ-OR-PROVISION.
// Returns the DB user for the authenticated Clerk user.
// If the user is not in the DB yet (webhook missed, local dev, etc.)
// it auto-provisions an Organization + User + Settings + Membership.
//
// Race-condition safe: uses a Redis distributed lock + P2002 catch.
// ---------------------------------------------------------------------------
export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // ── 1. Redis cache hit ────────────────────────────────────────────────────
  const cached = await cacheGet<CurrentUserPayload>(CacheKey.user(userId));
  if (cached) return cached;

  // ── 2. DB read ────────────────────────────────────────────────────────────
  const existing = await fetchUserFromDb(userId);
  if (existing) {
    await cacheSet(CacheKey.user(userId), existing, TTL.USER_SESSION);
    return existing;
  }

  // ── 3. Fallback: auto-provision ───────────────────────────────────────────
  return autoProvision(userId);
}

// ---------------------------------------------------------------------------
// autoProvision — internal, only called when the user doesn't exist in DB
// ---------------------------------------------------------------------------
async function autoProvision(userId: string) {
  const lockKey = `finrp:provision:${userId}`;
  const locked  = await acquireLock(lockKey, 30);

  try {
    // Double-check after acquiring the lock.
    // Another instance may have provisioned between our DB read and lock acquire.
    if (locked) {
      const existingAfterLock = await fetchUserFromDb(userId);
      if (existingAfterLock) {
        await cacheSet(CacheKey.user(userId), existingAfterLock, TTL.USER_SESSION);
        return existingAfterLock;
      }
    }

    // Fetch Clerk profile for name/email
    const clerkUser = await currentUser();
    if (!clerkUser) throw new Error("Unauthorized");

    const email =
      clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email.split("@")[0];

    // ── Single transaction: create org → user → membership ─────────────────
    // If user.create throws P2002 (concurrent winner), the transaction rolls
    // back entirely — org is not persisted — so no orphan organizations.
    let provisioned: CurrentUserPayload;

    try {
      provisioned = await prisma.$transaction(async (tx) => {
        const orgName = name ? `${name}'s Organization` : "My Organization";

        const organization = await tx.organization.create({
          data: {
            name: orgName,
            slug: generateSlug(orgName),
            plan: "FREE",
            settings: {
              create: {
                inventoryEnabled:    true,
                payrollEnabled:      true,
                complianceEnabled:   true,
                loanModuleEnabled:   true,
                defaultTaxRate:      18,
                taxLabel:            "GST",
                invoicePrefix:       "INV",
                invoiceStartNumber:  1,
                defaultPaymentTerms: 30,
                emailNotifications:  true,
                overdueReminderDays: 3,
                lowStockThreshold:   10,
                dateFormat:          "DD/MM/YYYY",
                numberFormat:        "en-IN",
              },
            },
          },
        });

        const user = await tx.user.create({
          data: {
            clerkId:        userId,
            email,
            name,
            role:           "OWNER",
            avatarUrl:      clerkUser.imageUrl ?? null,
            isActive:       true,
            organizationId: organization.id,
          },
          include: {
            organization: { include: { businessProfile: true } },
          },
        });

        await tx.organization.update({
          where: { id: organization.id },
          data:  { createdBy: user.id },
        });

        await tx.membership.create({
          data: {
            userId:         user.id,
            organizationId: organization.id,
            role:           "OWNER",
            invitedBy:      user.id,
          },
        });

        return user;
      });
    } catch (txErr: unknown) {
      // P2002 on clerkId: a concurrent request won the race.
      // The transaction rolled back cleanly (no orphan org).
      // Fetch the user that the winner created.
      const prismaErr = txErr as { code?: string; meta?: { target?: string[] | string } };
      const isPrimaryKeyViolation =
        prismaErr?.code === "P2002" &&
        JSON.stringify(prismaErr?.meta?.target ?? "").includes("clerkId");

      if (isPrimaryKeyViolation) {
        const raceWinner = await fetchUserFromDb(userId);
        if (raceWinner) {
          await cacheSet(CacheKey.user(userId), raceWinner, TTL.USER_SESSION);
          await cacheSet(CacheKey.tenant(userId), raceWinner.organizationId, TTL.TENANT_ID);
          return raceWinner;
        }
      }
      throw txErr;
    }

    console.log(`[session] provisioned user ${provisioned.id} (${email})`);

    // Prime both caches so the first API call and layout render skip DB
    await cacheSet(CacheKey.user(userId),   provisioned,                    TTL.USER_SESSION);
    await cacheSet(CacheKey.tenant(userId), provisioned.organizationId,     TTL.TENANT_ID);

    return provisioned;
  } finally {
    if (locked) await releaseLock(lockKey);
  }
}

// ---------------------------------------------------------------------------
// getOptionalUser
// Like getCurrentUser() but returns null instead of throwing.
// ---------------------------------------------------------------------------
export async function getOptionalUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// invalidateUserCache
// Call after any mutation that changes the user's role, org, or onboarding
// state so the next render re-reads from DB.
// ---------------------------------------------------------------------------
export async function invalidateUserCache(clerkId: string): Promise<void> {
  await cacheDel(CacheKey.user(clerkId), CacheKey.tenant(clerkId));
}
