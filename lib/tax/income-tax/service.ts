// ============================================================
// lib/tax/income-tax/service.ts
//
// Orchestrates ITR computation: resolves the AY config, computes both
// regimes, recommends one, persists ItrComputation, and wires the
// chosen result into the filing review checkpoint.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { ItrRegimeKind, Prisma } from "@prisma/client";
import { resolveTaxConfig } from "../config/loader";
import { encryptPan, isValidPan } from "../core/pii";
import { round2 } from "../core/money";
import { upsertSubmission, setReady, type FilingActor } from "../filing/service";
import { compareRegimes, computeRegime, suggestItrForm, buildItrPayload, type IncomeInput, type Regime } from "./compute";

export interface ComputeItrParams {
  organizationId: string;
  assessmentYear: string;
  regime?: ItrRegimeKind; // when omitted, the recommended regime is used
  pan?: string;
  salary: number;
  houseProperty: number;
  business: number;
  capitalGains: number;
  other: number;
  deductions: Record<string, number>;
  isSalaried: boolean;
  advanceTaxPaid: number;
  tdsCredit: number;
  actor: FilingActor;
}

export async function computeItr(params: ComputeItrParams) {
  const config = await resolveTaxConfig({ scheme: "INCOME_TAX", period: params.assessmentYear, axis: "AY", organizationId: params.organizationId });

  const input: IncomeInput = {
    salary: params.salary,
    houseProperty: params.houseProperty,
    business: params.business,
    capitalGains: params.capitalGains,
    other: params.other,
    deductions: params.deductions,
    isSalaried: params.isSalaried,
    advanceTaxPaid: params.advanceTaxPaid,
    tdsCredit: params.tdsCredit,
  };

  const comparison = compareRegimes(input, config.incomeTax);
  const chosen: Regime = params.regime ?? comparison.recommended;
  const result = computeRegime(input, config.incomeTax, chosen);
  const form = suggestItrForm(input);
  const payload = buildItrPayload(input, result, params.assessmentYear, form);

  const hasPan = !!params.pan && isValidPan(params.pan);

  const computation = await prisma.itrComputation.create({
    data: {
      organizationId: params.organizationId,
      assessmentYear: params.assessmentYear,
      panEnc: hasPan ? encryptPan(params.pan!) : null,
      regime: chosen,
      formType: form as Prisma.ItrComputationCreateInput["formType"],
      salaryIncome: round2(params.salary),
      housePropertyIncome: round2(params.houseProperty),
      businessIncome: round2(params.business),
      capitalGainsIncome: round2(params.capitalGains),
      otherIncome: round2(params.other),
      grossTotalIncome: round2(result.grossTotalIncome),
      deductions: params.deductions as Prisma.InputJsonValue,
      totalDeductions: round2(result.totalDeductions),
      taxableIncome: round2(result.taxableIncome),
      taxBeforeRebate: round2(result.taxBeforeRebate),
      rebate87A: round2(result.rebate87A),
      surcharge: round2(result.surcharge),
      cess: round2(result.cess),
      totalTax: round2(result.totalTax),
      advanceTaxPaid: round2(params.advanceTaxPaid),
      tdsCredit: round2(params.tdsCredit),
      netPayable: round2(result.netPayable),
      refundDue: round2(result.refundDue),
      recommendedRegime: comparison.recommended,
      comparison: { old: comparison.old, new: comparison.new, saving: comparison.saving } as unknown as Prisma.InputJsonValue,
      payload: payload as Prisma.InputJsonValue,
      computedById: params.actor.userId,
    },
  });

  const submission = await upsertSubmission({
    organizationId: params.organizationId,
    scheme: "INCOME_TAX",
    returnType: form,
    period: params.assessmentYear,
    actor: params.actor,
  });
  const ready = await setReady({
    submissionId: submission.id,
    organizationId: params.organizationId,
    payload: payload as Prisma.InputJsonValue,
    summary: { regime: chosen, totalTax: result.totalTax, netPayable: result.netPayable, refundDue: result.refundDue } as Prisma.InputJsonValue,
    validationBlocked: false,
    actor: params.actor,
  });
  await prisma.itrComputation.update({ where: { id: computation.id }, data: { submissionId: submission.id } });

  return { computation, submission: ready, comparison, result, form };
}

export async function listItrComputations(organizationId: string, assessmentYear?: string) {
  return prisma.itrComputation.findMany({
    where: { organizationId, deletedAt: null, ...(assessmentYear ? { assessmentYear } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
