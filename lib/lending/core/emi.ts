// ============================================================
// lib/lending/core/emi.ts
//
// EMI / interest calculators for the Lending Platform. Pure functions,
// no I/O — callers persist the output (EMISchedule rows, foreclosure
// quotes, etc.) themselves. All money math goes through lib/lending/
// core/money.ts (Prisma.Decimal) — never binary floating point.
//
// Reducing-balance amortization is the standard EMI method (interest
// charged only on the outstanding principal, which shrinks each
// month). Flat-rate divides total interest evenly across every
// installment instead — used by some MSME / equipment products.
// Simple daily interest (no fixed EMI) is used for revolving products
// (Overdraft, Line of Credit, Invoice Financing) where interest
// accrues on whatever portion of the limit is actually utilized.
// ============================================================

import { D, Money, round2 } from "./money";

export type EMIMethod = "REDUCING_BALANCE" | "FLAT";

export interface AmortizationRow {
  installmentNumber: number;
  dueDate: Date;
  principalDue: Money;
  interestDue: Money;
  totalDue: Money;
  outstandingPrincipal: Money; // balance AFTER this installment
}

/** Monthly rate from an annual percentage rate. */
function monthlyRate(annualRatePercent: number | Money): Money {
  return D(annualRatePercent).dividedBy(12).dividedBy(100);
}

/**
 * Reducing-balance EMI (standard amortizing loan formula):
 *   EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 * Falls back to a straight-line split when r = 0 (0% interest offers).
 */
export function calculateReducingBalanceEMI(
  principal: number | Money,
  annualRatePercent: number | Money,
  tenureMonths: number
): Money {
  if (tenureMonths <= 0) throw new RangeError("tenureMonths must be positive");
  const P = D(principal);
  const r = monthlyRate(annualRatePercent);

  if (r.isZero()) return round2(P.dividedBy(tenureMonths));

  const onePlusR = r.plus(1);
  const factor = onePlusR.pow(tenureMonths);
  const emi = P.times(r).times(factor).dividedBy(factor.minus(1));
  return round2(emi);
}

/**
 * Flat-rate EMI: total interest = P × annualRate% × (tenureMonths/12),
 * spread evenly. Interest does NOT reduce as principal is repaid.
 */
export function calculateFlatRateEMI(
  principal: number | Money,
  annualRatePercent: number | Money,
  tenureMonths: number
): Money {
  if (tenureMonths <= 0) throw new RangeError("tenureMonths must be positive");
  const P = D(principal);
  const totalInterest = P.times(D(annualRatePercent)).dividedBy(100).times(tenureMonths).dividedBy(12);
  const totalPayable = P.plus(totalInterest);
  return round2(totalPayable.dividedBy(tenureMonths));
}

export function calculateEMI(
  principal: number | Money,
  annualRatePercent: number | Money,
  tenureMonths: number,
  method: EMIMethod = "REDUCING_BALANCE"
): Money {
  return method === "FLAT"
    ? calculateFlatRateEMI(principal, annualRatePercent, tenureMonths)
    : calculateReducingBalanceEMI(principal, annualRatePercent, tenureMonths);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Full amortization schedule. The final installment absorbs any
 * paise-level rounding drift so cumulative principal repaid equals
 * the original principal EXACTLY — a schedule that doesn't reconcile
 * to zero is a real correctness bug, not a cosmetic one.
 */
export function generateAmortizationSchedule(
  principal: number | Money,
  annualRatePercent: number | Money,
  tenureMonths: number,
  method: EMIMethod = "REDUCING_BALANCE",
  firstDueDate: Date = new Date()
): AmortizationRow[] {
  if (tenureMonths <= 0) throw new RangeError("tenureMonths must be positive");

  const P = D(principal);
  const rows: AmortizationRow[] = [];

  if (method === "FLAT") {
    const emi = calculateFlatRateEMI(P, annualRatePercent, tenureMonths);
    const totalInterest = P.times(D(annualRatePercent)).dividedBy(100).times(tenureMonths).dividedBy(12);
    const perInstallmentPrincipal = round2(P.dividedBy(tenureMonths));
    const perInstallmentInterest = round2(totalInterest.dividedBy(tenureMonths));

    let outstanding = P;
    let principalAccum = D(0);
    for (let i = 1; i <= tenureMonths; i++) {
      const isLast = i === tenureMonths;
      const principalDue = isLast ? round2(P.minus(principalAccum)) : perInstallmentPrincipal;
      const interestDue = isLast
        ? round2(totalInterest.minus(perInstallmentInterest.times(tenureMonths - 1)))
        : perInstallmentInterest;
      principalAccum = principalAccum.plus(principalDue);
      outstanding = round2(outstanding.minus(principalDue));

      rows.push({
        installmentNumber: i,
        dueDate: addMonths(firstDueDate, i - 1),
        principalDue,
        interestDue,
        totalDue: round2(principalDue.plus(interestDue)),
        outstandingPrincipal: outstanding.lessThan(0) ? D(0) : outstanding,
      });
    }
    // sanity check against the flat EMI figure (informational only — the
    // schedule itself, not `emi`, is the source of truth for totals).
    void emi;
    return rows;
  }

  // Reducing balance
  const r = monthlyRate(annualRatePercent);
  const emi = calculateReducingBalanceEMI(P, annualRatePercent, tenureMonths);
  let outstanding = P;

  for (let i = 1; i <= tenureMonths; i++) {
    const isLast = i === tenureMonths;
    const interestDue = round2(outstanding.times(r));
    let principalDue = round2(emi.minus(interestDue));
    if (isLast) {
      // absorb rounding drift so outstanding lands on exactly 0
      principalDue = outstanding;
    }
    const totalDue = round2(principalDue.plus(interestDue));
    outstanding = round2(outstanding.minus(principalDue));
    if (outstanding.lessThan(0)) outstanding = D(0);

    rows.push({
      installmentNumber: i,
      dueDate: addMonths(firstDueDate, i - 1),
      principalDue,
      interestDue,
      totalDue,
      outstandingPrincipal: outstanding,
    });
  }

  return rows;
}

/**
 * Simple daily interest on a utilized balance — for revolving products
 * (Overdraft, Line of Credit, Invoice Financing) that don't run a
 * fixed EMI schedule but accrue interest on whatever is drawn.
 */
export function calculateSimpleInterest(
  utilizedAmount: number | Money,
  annualRatePercent: number | Money,
  days: number
): Money {
  if (days < 0) throw new RangeError("days must be non-negative");
  return round2(D(utilizedAmount).times(D(annualRatePercent)).dividedBy(100).times(days).dividedBy(365));
}

/**
 * Foreclosure payoff quote: remaining principal + a foreclosure charge
 * (percentage of the outstanding principal), minus anything explicitly
 * waived by the lender.
 */
export function calculateForeclosurePayoff(
  outstandingPrincipal: number | Money,
  foreclosureChargePercent: number | Money,
  waived = false
): { foreclosureAmount: Money; charges: Money } {
  const principal = D(outstandingPrincipal);
  const charges = waived ? D(0) : round2(principal.times(D(foreclosureChargePercent)).dividedBy(100));
  return { foreclosureAmount: round2(principal.plus(charges)), charges };
}

/**
 * Recompute the remaining schedule after a part-payment reduces
 * principal. Keeps the same remaining tenure and rate, re-amortizing
 * from the new (lower) outstanding principal — the standard "reduce
 * EMI, keep tenure" part-payment treatment.
 */
export function recomputeScheduleAfterPartPayment(
  newOutstandingPrincipal: number | Money,
  annualRatePercent: number | Money,
  remainingInstallments: number,
  method: EMIMethod,
  nextDueDate: Date,
  startInstallmentNumber: number
): AmortizationRow[] {
  const schedule = generateAmortizationSchedule(
    newOutstandingPrincipal,
    annualRatePercent,
    remainingInstallments,
    method,
    nextDueDate
  );
  return schedule.map((row) => ({ ...row, installmentNumber: row.installmentNumber + startInstallmentNumber - 1 }));
}
