// ============================================================
// lib/auth/invitation-type.ts
//
// Pure classifier — no schema column backs this. Invitation type is
// always derived from the record that already exists:
//   • CustomerInvitation rows                                → CUSTOMER
//   • Invitation rows with firmId set (joining a CA firm)    → FIRM_MEMBER
//   • Invitation rows without firmId but userRole CA/ADMIN   → CA
//   • Everything else (plain business-team invite)           → CUSTOMER
// ============================================================

import type { UserRole } from "@prisma/client";

export type InvitationType = "CUSTOMER" | "CA" | "FIRM_MEMBER";

export type InvitationTypeInput =
  | { kind: "CUSTOMER" }
  | { kind: "TEAM"; firmId: string | null; userRole: UserRole | null };

export function getInvitationType(input: InvitationTypeInput): InvitationType {
  if (input.kind === "CUSTOMER") return "CUSTOMER";
  if (input.firmId) return "FIRM_MEMBER";
  if (input.userRole === "CA" || input.userRole === "CA_FIRM_ADMIN") return "CA";
  return "CUSTOMER";
}
