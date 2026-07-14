// ============================================================
// lib/kyc/guards.ts
//
// Module 10 — Workspace Activation. Mirrors lib/billing/guards.ts's
// shape (pure resolver + throwing assert), with one hard requirement
// carried over from that file's own GRANDFATHERING pattern: an
// organization with NO KycProfile row predates this feature and must
// never be locked out by its rollout.
//
// Scope (deliberate, see docs/TBX_FOUNDATION.md §13 Risk 5): this
// guard is NOT retrofitted onto the ~130 existing write routes in
// this phase. It is:
//   1. Read by the UI (KycStatusProvider) to show a read-only banner
//      and disable mutation controls on the Business dashboard only.
//   2. Available for NEW routes (this module's own, and future
//      Payments/Collections/Loans modules) to opt into via
//      assertWorkspaceWritable() / requireTenant({ requireKyc }).
// It is intentionally NOT wired into app/(firm)/layout.tsx — CA-tenant
// orgs have no wizard path to ever reach APPROVED in this phase.
// ============================================================

import { kycProfileRepository } from "@/lib/repositories/kyc-profile.repository";
import type { KycStatus } from "@prisma/client";

export class KycRequiredError extends Error {
  readonly status = 403;
  readonly kycStatus: KycStatus | null;
  constructor(kycStatus: KycStatus | null, message = "Workspace is read-only until KYC verification is approved") {
    super(message);
    this.name = "KycRequiredError";
    this.kycStatus = kycStatus;
  }
}

export interface KycReadOnlyState {
  readOnly: boolean;
  status: KycStatus | null;
}

/**
 * True once the org's KYC is APPROVED. Orgs with no KycProfile row at
 * all predate this feature (grandfathered — never read-only), exactly
 * mirroring lib/billing/entitlements.ts's `isLegacy` rule for orgs
 * with no planType. Read-only, never creates a row.
 */
export async function isKycComplete(organizationId: string): Promise<boolean> {
  const profile = await kycProfileRepository.findByOrg(organizationId);
  if (!profile) return true;
  return profile.status === "APPROVED";
}

/** Full read-only state (for the UI banner) — status included for messaging. */
export async function getKycReadOnlyState(organizationId: string): Promise<KycReadOnlyState> {
  const profile = await kycProfileRepository.findByOrg(organizationId);
  if (!profile) return { readOnly: false, status: null };
  return { readOnly: profile.status !== "APPROVED", status: profile.status };
}

/** Throws KycRequiredError unless the org's KYC is APPROVED (or grandfathered). */
export async function assertWorkspaceWritable(organizationId: string): Promise<void> {
  const state = await getKycReadOnlyState(organizationId);
  if (state.readOnly) throw new KycRequiredError(state.status);
}
