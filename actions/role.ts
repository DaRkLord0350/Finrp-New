"use server";

// ============================================================
// Role selection server action
// Called when a new user chooses "CA Firm" or "Customer" on the
// /onboarding/role screen.
//
// Responsibilities:
//  1. Validate the selection
//  2. Persist the role to the DB User record
//  3. Sync the role to Clerk publicMetadata
//  4. Return the correct redirect path for the caller
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { UserRole } from "@prisma/client";

export type SelectableRole = "CUSTOMER" | "CA_FIRM_ADMIN";

export interface SelectRoleResult {
  success: boolean;
  redirectTo?: string;
  error?: string;
}

export async function actionSelectRole(
  selectedRole: SelectableRole
): Promise<SelectRoleResult> {
  try {
    const user = await getCurrentUser();

    // Idempotency: if role already set, return the correct redirect
    if (user.userRole) {
      return {
        success: true,
        redirectTo: getRedirectPath(user.userRole),
      };
    }

    if (selectedRole !== "CUSTOMER" && selectedRole !== "CA_FIRM_ADMIN") {
      return { success: false, error: "Invalid role selection" };
    }

    // 1. Persist role to DB
    await prisma.user.update({
      where: { id: user.id },
      data: { userRole: selectedRole as UserRole },
    });

    // 2. Sync to Clerk publicMetadata so the JWT reflects the role
    const client = await clerkClient();
    await client.users.updateUser(user.clerkId, {
      publicMetadata: { userRole: selectedRole },
    });

    const redirectTo =
      selectedRole === "CA_FIRM_ADMIN"
        ? "/onboarding/ca-firm"
        : "/onboarding/customer";

    return { success: true, redirectTo };
  } catch (err) {
    console.error("[actionSelectRole]", err);
    return { success: false, error: "Failed to save role selection. Please try again." };
  }
}

function getRedirectPath(role: UserRole): string {
  switch (role) {
    case "CA_FIRM_ADMIN":
      return "/onboarding/ca-firm";
    case "CA":
      return "/ca";
    case "ADMIN":
      return "/admin";
    default:
      return "/onboarding/customer";
  }
}
