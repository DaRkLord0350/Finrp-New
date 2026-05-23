// ============================================================
// lib/auth/session.ts
// Gets the current authenticated user from DB.
// Auto-provisions a User + Organization if the Clerk user
// exists but hasn't been synced yet (e.g. webhook missed).
// ============================================================

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

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
// getCurrentUser
// Returns the DB User record for the currently authenticated Clerk user.
// If the user is not in the DB yet (webhook not received), auto-provisions
// an Organization + User + Settings so the app never hard-crashes.
// ---------------------------------------------------------------------------
export async function getCurrentUser() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Happy path — user exists
  const existing = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { organization: true },
  });

  if (existing) return existing;

  // ── Fallback auto-provision ─────────────────────────────────────────────
  // Clerk webhook may not have fired yet (local dev, race condition, etc.)
  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("Unauthorized");

  const email =
    clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    email.split("@")[0];

  const provisioned = await prisma.$transaction(async (tx) => {
    const orgName = name ? `${name}'s Organization` : "My Organization";

    const organization = await tx.organization.create({
      data: {
        name: orgName,
        slug: generateSlug(orgName),
        plan: "FREE",
        settings: {
          create: {
            inventoryEnabled: true,
            payrollEnabled: true,
            complianceEnabled: true,
            loanModuleEnabled: true,
            defaultTaxRate: 18,
            taxLabel: "GST",
            invoicePrefix: "INV",
            invoiceStartNumber: 1,
            defaultPaymentTerms: 30,
            emailNotifications: true,
            overdueReminderDays: 3,
            lowStockThreshold: 10,
            dateFormat: "DD/MM/YYYY",
            numberFormat: "en-IN",
          },
        },
      },
    });

    const user = await tx.user.create({
      data: {
        clerkId: userId,
        email,
        name,
        role: "OWNER",
        avatarUrl: clerkUser.imageUrl ?? null,
        isActive: true,
        organizationId: organization.id,
      },
      include: { organization: true },
    });

    return user;
  });

  console.log(`[session] Auto-provisioned user ${provisioned.id} (${email})`);
  return provisioned;
}

// ---------------------------------------------------------------------------
// getOptionalUser
// Like getCurrentUser but returns null instead of throwing.
// Use in pages that partially render for logged-out users.
// ---------------------------------------------------------------------------
export async function getOptionalUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}
