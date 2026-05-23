import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Gets the correct organization ID for the current user
 * - First tries to get from the user's DB record
 * - Falls back to Clerk orgId if user is part of an organization
 * - Finally falls back to userId
 */
export async function getTenantId(): Promise<string | null> {
  const { userId, orgId } = await auth();
  
  if (!userId) return null;

  // Try to get organization from DB user record (most reliable)
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (dbUser?.organizationId) {
    return dbUser.organizationId;
  }

  // Fallback to Clerk orgId if user is part of an organization
  if (orgId) {
    return orgId;
  }

  // Final fallback to userId
  return userId;
}
