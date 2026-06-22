// ============================================================
// lib/tax/tds/service.ts
//
// TDS engine: deductees (PAN encrypted), challans, deductions with
// section-rate computation (from versioned config), and quarterly
// return computation wired into the filing review checkpoint.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { Prisma, TdsDeducteeKind, TdsReturnForm } from "@prisma/client";
import { resolveTaxConfig } from "../config/loader";
import type { TdsSectionRule } from "../config/types";
import { encryptPan, maskPan, isValidPan } from "../core/pii";
import { round2, toNumber } from "../core/money";
import { assessmentYearOf } from "../core/period";
import { upsertSubmission, setReady, type FilingActor } from "../filing/service";

/** Resolve a TDS section rule for an FY. */
export async function getTdsSection(organizationId: string, fy: string, code: string): Promise<TdsSectionRule | undefined> {
  const config = await resolveTaxConfig({ scheme: "TDS", period: fy, organizationId });
  return config.tds.sections.find((s) => s.code === code);
}

export interface TdsComputeInput {
  amountPaid: number;
  section: string;
  hasPan: boolean;
  isIndividual: boolean;
}

export interface TdsComputeResult {
  applicable: boolean;
  rate: number;
  tds: number;
  reason?: string;
}

/** Compute TDS for a single payment using the versioned section rules. */
export function computeTds(input: TdsComputeInput, rule: TdsSectionRule | undefined): TdsComputeResult {
  if (!rule) return { applicable: false, rate: 0, tds: 0, reason: `Unknown section ${input.section}` };
  if (input.amountPaid < rule.thresholdSingle && rule.thresholdSingle > 0) {
    return { applicable: false, rate: 0, tds: 0, reason: `Below single-payment threshold ₹${rule.thresholdSingle}` };
  }
  const rate = !input.hasPan ? rule.rateNoPan : input.isIndividual ? rule.rateIndividual : rule.rateOther;
  const tds = round2((input.amountPaid * rate) / 100).toNumber();
  return { applicable: true, rate, tds };
}

// ── Deductees ─────────────────────────────────────────────────
export async function createDeductee(params: {
  organizationId: string;
  name: string;
  pan?: string;
  deducteeType?: TdsDeducteeKind;
  email?: string;
  phone?: string;
  createdById?: string;
}) {
  const hasPan = !!params.pan && isValidPan(params.pan);
  return prisma.tdsDeductee.create({
    data: {
      organizationId: params.organizationId,
      name: params.name,
      panEnc: hasPan ? encryptPan(params.pan!) : null,
      panMasked: hasPan ? maskPan(params.pan!) : null,
      deducteeType: params.deducteeType ?? "OTHER",
      email: params.email,
      phone: params.phone,
      createdById: params.createdById,
    },
  });
}

export async function listDeductees(organizationId: string) {
  return prisma.tdsDeductee.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, panMasked: true, deducteeType: true, email: true, createdAt: true },
  });
}

// ── Challans ──────────────────────────────────────────────────
export async function createChallan(params: {
  organizationId: string;
  financialYear: string;
  quarter: string;
  section: string;
  bsrCode?: string;
  challanNo?: string;
  depositDate?: string;
  tdsAmount: number;
  interest?: number;
  fee?: number;
  createdById?: string;
}) {
  const total = (params.tdsAmount ?? 0) + (params.interest ?? 0) + (params.fee ?? 0);
  return prisma.tdsChallan.create({
    data: {
      organizationId: params.organizationId,
      financialYear: params.financialYear,
      quarter: params.quarter,
      section: params.section,
      bsrCode: params.bsrCode,
      challanNo: params.challanNo,
      depositDate: params.depositDate ? new Date(params.depositDate) : null,
      tdsAmount: round2(params.tdsAmount),
      interest: round2(params.interest ?? 0),
      fee: round2(params.fee ?? 0),
      totalAmount: round2(total),
      createdById: params.createdById,
    },
  });
}

// ── Deductions ────────────────────────────────────────────────
export async function createDeduction(params: {
  organizationId: string;
  deducteeId: string;
  challanId?: string;
  section: string;
  financialYear: string;
  quarter: string;
  paymentDate: string;
  amountPaid: number;
  isIndividual?: boolean;
  tdsDeducted?: number;
  createdById?: string;
}) {
  const deductee = await prisma.tdsDeductee.findFirst({ where: { id: params.deducteeId, organizationId: params.organizationId } });
  if (!deductee) throw new Error("Deductee not found");
  const hasPan = !!deductee.panEnc;

  const rule = await getTdsSection(params.organizationId, params.financialYear, params.section);
  const computed = computeTds(
    { amountPaid: params.amountPaid, section: params.section, hasPan, isIndividual: params.isIndividual ?? deductee.deducteeType === "INDIVIDUAL" },
    rule
  );
  const tds = params.tdsDeducted ?? computed.tds;

  return prisma.tdsDeduction.create({
    data: {
      organizationId: params.organizationId,
      deducteeId: params.deducteeId,
      challanId: params.challanId,
      section: params.section,
      financialYear: params.financialYear,
      quarter: params.quarter,
      paymentDate: new Date(params.paymentDate),
      amountPaid: round2(params.amountPaid),
      tdsRate: computed.rate,
      tdsDeducted: round2(tds),
      deductionDate: new Date(params.paymentDate),
      noPan: !hasPan,
      createdById: params.createdById,
    },
  });
}

// ── Quarterly return computation + filing ─────────────────────
export async function computeTdsReturn(params: {
  organizationId: string;
  formType: TdsReturnForm;
  financialYear: string;
  quarter: string;
  actor: FilingActor;
}) {
  const { organizationId, formType, financialYear, quarter } = params;

  const [deductions, challans] = await Promise.all([
    prisma.tdsDeduction.findMany({ where: { organizationId, financialYear, quarter } }),
    prisma.tdsChallan.findMany({ where: { organizationId, financialYear, quarter, deletedAt: null } }),
  ]);

  const totalDeducted = deductions.reduce((s, d) => s + toNumber(d.tdsDeducted), 0);
  const totalDeposited = challans.reduce((s, c) => s + toNumber(c.tdsAmount), 0);
  const totalInterest = challans.reduce((s, c) => s + toNumber(c.interest) + toNumber(c.fee), 0);
  const deducteeIds = new Set(deductions.map((d) => d.deducteeId));
  const shortfall = Math.max(0, totalDeducted - totalDeposited);

  const payload = {
    form: formType,
    fy: financialYear,
    ay: assessmentYearOf(financialYear),
    quarter,
    totals: { totalDeducted: round2(totalDeducted).toNumber(), totalDeposited: round2(totalDeposited).toNumber(), shortfall: round2(shortfall).toNumber() },
    deductees: deducteeIds.size,
    deductions: deductions.map((d) => ({ section: d.section, amountPaid: toNumber(d.amountPaid), tds: toNumber(d.tdsDeducted), rate: toNumber(d.tdsRate) })),
    challans: challans.map((c) => ({ bsrCode: c.bsrCode, challanNo: c.challanNo, amount: toNumber(c.tdsAmount) })),
  };

  const computation = await prisma.tdsReturnComputation.upsert({
    where: { organizationId_formType_financialYear_quarter: { organizationId, formType, financialYear, quarter } },
    create: {
      organizationId, formType, financialYear, quarter,
      totalDeducted: round2(totalDeducted), totalDeposited: round2(totalDeposited),
      totalInterest: round2(totalInterest), shortfall: round2(shortfall),
      deducteeCount: deducteeIds.size, deductionCount: deductions.length,
      payload: payload as Prisma.InputJsonValue, computedById: params.actor.userId,
    },
    update: {
      totalDeducted: round2(totalDeducted), totalDeposited: round2(totalDeposited),
      totalInterest: round2(totalInterest), shortfall: round2(shortfall),
      deducteeCount: deducteeIds.size, deductionCount: deductions.length,
      payload: payload as Prisma.InputJsonValue, computedById: params.actor.userId,
    },
  });

  const submission = await upsertSubmission({
    organizationId, scheme: "TDS", returnType: formType, period: `${financialYear}-${quarter}`, actor: params.actor,
  });
  const ready = await setReady({
    submissionId: submission.id, organizationId,
    payload: payload as Prisma.InputJsonValue,
    summary: { totalDeducted: round2(totalDeducted).toNumber(), shortfall: round2(shortfall).toNumber() } as Prisma.InputJsonValue,
    validationBlocked: false, actor: params.actor,
  });
  await prisma.tdsReturnComputation.update({ where: { id: computation.id }, data: { submissionId: submission.id } });

  return { computation, submission: ready, payload };
}
