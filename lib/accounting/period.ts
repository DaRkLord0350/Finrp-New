// ============================================================
// Accounting period guard
//
// `assertPostingAllowed` is the single chokepoint every posting path
// (manual journals, document→ledger posting, reversals) calls before
// writing to the ledger on a given date.
//
// Phase 1 ships a no-op (no lock/fiscal-period models exist yet).
// Phase 3 implements the body against AccountingSettings.lockDate and
// FiscalPeriod status, honoring an `accounting.manage` override — the
// call sites do not change.
// ============================================================

export class PeriodLockedError extends Error {
  constructor(message: string, readonly status: number = 422) {
    super(message);
    this.name = "PeriodLockedError";
  }
}

export interface PostingGuardOptions {
  /** Effective role of the actor; an `accounting.manage` holder may override a lock. */
  canOverride?: boolean;
}

/**
 * Throws PeriodLockedError when posting on `date` is not permitted.
 * No-op until Phase 3 introduces period locking.
 */
export async function assertPostingAllowed(
  organizationId: string,
  date: Date,
  opts: PostingGuardOptions = {}
): Promise<void> {
  // Phase 1: no period-locking models exist yet, so every date is open.
  // Phase 3 implements the real check here against AccountingSettings.lockDate
  // and FiscalPeriod status, allowing an override when opts.canOverride is set.
  if (!organizationId || !date) return;
  if (opts.canOverride) return;
  return;
}
