// ============================================================
// lib/firm/onboarding.ts
//
// Onboarding-funnel stage model for the firm Onboarding page.
// Stages are DERIVED from timestamps/signals (not stored as a DB
// enum) so they can never drift out of sync with the underlying
// lifecycle. Used by the CA-onboarding and customer-onboarding tabs.
// ============================================================

import { appBaseUrl } from "@/lib/customer-invitations/constants";

// ── CA onboarding ───────────────────────────────────────────
export const CA_STAGES = [
  "INVITE_SENT",
  "EMAIL_OPENED",
  "ACCOUNT_CREATED",
  "PROFILE_COMPLETED",
  "ACTIVE",
] as const;
export type CaStage = (typeof CA_STAGES)[number];

export const CA_STAGE_LABELS: Record<CaStage, string> = {
  INVITE_SENT: "Invite Sent",
  EMAIL_OPENED: "Email Opened",
  ACCOUNT_CREATED: "Account Created",
  PROFILE_COMPLETED: "Profile Completed",
  ACTIVE: "Active",
};

export const CA_STAGE_COLORS: Record<CaStage, string> = {
  INVITE_SENT: "#94a3b8",
  EMAIL_OPENED: "#f59e0b",
  ACCOUNT_CREATED: "#0ea5e9",
  PROFILE_COMPLETED: "#8b5cf6",
  ACTIVE: "#10b981",
};

export interface CaInviteSignals {
  emailOpenedAt: Date | null;
  acceptedAt: Date | null;
}
export interface CaUserSignals {
  profileCompletedAt: Date | null;
  lastLoginAt: Date | null;
  lastActiveAt: Date | null;
  isActive: boolean;
}

/** Derive the CA's onboarding stage from their invite + (optional) user row. */
export function deriveCaStage(
  invite: CaInviteSignals,
  user: CaUserSignals | null
): CaStage {
  if (user) {
    if (user.isActive && (user.lastLoginAt || user.lastActiveAt)) return "ACTIVE";
    if (user.profileCompletedAt) return "PROFILE_COMPLETED";
    return "ACCOUNT_CREATED";
  }
  if (invite.acceptedAt) return "ACCOUNT_CREATED";
  if (invite.emailOpenedAt) return "EMAIL_OPENED";
  return "INVITE_SENT";
}

// ── Customer onboarding ─────────────────────────────────────
export const CUSTOMER_STAGES = [
  "INVITE_SENT",
  "ACCEPTED",
  "DOCUMENTS_UPLOADED",
  "BANK_CONNECTED",
  "COMPLETED",
] as const;
export type CustomerStage = (typeof CUSTOMER_STAGES)[number];

export const CUSTOMER_STAGE_LABELS: Record<CustomerStage, string> = {
  INVITE_SENT: "Invite Sent",
  ACCEPTED: "Accepted",
  DOCUMENTS_UPLOADED: "Documents Uploaded",
  BANK_CONNECTED: "Bank Connected",
  COMPLETED: "Completed",
};

export const CUSTOMER_STAGE_COLORS: Record<CustomerStage, string> = {
  INVITE_SENT: "#94a3b8",
  ACCEPTED: "#0ea5e9",
  DOCUMENTS_UPLOADED: "#f59e0b",
  BANK_CONNECTED: "#8b5cf6",
  COMPLETED: "#10b981",
};

export interface CustomerInviteSignals {
  status: string;
  acceptedAt: Date | null;
  documentsUploadedAt: Date | null;
  bankConnectedAt: Date | null;
  completedAt: Date | null;
  /** Live count of documents uploaded by the linked customer (fallback signal). */
  documentCount?: number;
}

/** Derive a customer's onboarding stage from their invite + live signals. */
export function deriveCustomerStage(s: CustomerInviteSignals): CustomerStage {
  if (s.completedAt) return "COMPLETED";
  if (s.bankConnectedAt) return "BANK_CONNECTED";
  if (s.documentsUploadedAt || (s.documentCount ?? 0) > 0) return "DOCUMENTS_UPLOADED";
  if (s.acceptedAt || s.status === "ACCEPTED") return "ACCEPTED";
  return "INVITE_SENT";
}

// ── Progress ────────────────────────────────────────────────
/** Percentage complete for a stage within its ordered stage list. */
export function progressPct(
  stage: string,
  stages: readonly string[]
): number {
  const idx = stages.indexOf(stage);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / stages.length) * 100);
}

// ── Invite-link open tracking ───────────────────────────────
/**
 * Wraps an invite token in a tracking redirect. The recipient's click
 * stamps `emailOpenedAt` (a reliable engagement proxy for "opened")
 * before forwarding to the sign-up page. A true Resend open-pixel
 * webhook can later stamp the same field without changing callers.
 */
export function trackedInviteUrl(token: string): string {
  return `${appBaseUrl()}/api/track/invite?t=${encodeURIComponent(token)}`;
}
