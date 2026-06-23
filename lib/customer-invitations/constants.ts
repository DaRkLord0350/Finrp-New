// ============================================================
// lib/customer-invitations/constants.ts
//
// Shared constants + helpers for the customer onboarding invitation
// flow (CA / firm admin invites a customer by email → Clerk signup →
// auto-provision + auto-assign). See service.ts / accept.ts.
// ============================================================

export { EMAIL_REGEX } from "@/lib/team/constants";

/** How long a customer invitation stays valid before it expires. */
export const CUSTOMER_INVITE_TTL_DAYS = 14;

/** Hard cap on resends so a stuck invite can't be spammed indefinitely. */
export const MAX_INVITE_RESENDS = 5;

/** Public base URL used to build the tokenised sign-up / accept link. */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://app.finrp.in"
  ).replace(/\/$/, "");
}

/**
 * The link emailed to an invited customer. They sign up via Clerk with
 * the same email; the Clerk webhook / autoProvision matches the pending
 * invite by email (the token is carried for landing-page validation and
 * traceability).
 */
export function customerInviteUrl(token: string, email: string): string {
  return `${appBaseUrl()}/sign-up?email=${encodeURIComponent(email)}&invite=${encodeURIComponent(token)}`;
}

export function inviteExpiry(days = CUSTOMER_INVITE_TTL_DAYS): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
