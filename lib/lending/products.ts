// ============================================================
// lib/lending/products.ts
// Loan product catalog — per-lender-organization configuration.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { InterestRateType, LoanProductType, Prisma } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import type { EligibilityRuleSet } from "./core/eligibility";

export interface CreateLoanProductInput {
  code: string;
  name: string;
  type: LoanProductType;
  description?: string;
  minAmount: number;
  maxAmount: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  interestRateType?: InterestRateType;
  minInterestRate: number;
  maxInterestRate: number;
  processingFeePercent?: number;
  processingFeeFlat?: number;
  latePaymentPenaltyPercent?: number;
  foreclosureAllowed?: boolean;
  foreclosureChargePercent?: number;
  partPaymentAllowed?: boolean;
  partPaymentChargePercent?: number;
  collateralRequired?: boolean;
  eligibilityRules: EligibilityRuleSet;
}

export async function listProducts(organizationId: string, opts: { activeOnly?: boolean } = {}) {
  return prisma.loanProduct.findMany({
    where: { organizationId, deletedAt: null, ...(opts.activeOnly ? { isActive: true } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProduct(id: string, organizationId: string) {
  const product = await prisma.loanProduct.findFirst({ where: { id, organizationId, deletedAt: null } });
  if (!product) throw new Error("Loan product not found");
  return product;
}

export async function createProduct(organizationId: string, input: CreateLoanProductInput, actor: { userId: string }) {
  if (input.minAmount <= 0 || input.maxAmount < input.minAmount) {
    throw new Error("Invalid amount range: maxAmount must be >= minAmount > 0");
  }
  if (input.minTenureMonths <= 0 || input.maxTenureMonths < input.minTenureMonths) {
    throw new Error("Invalid tenure range: maxTenureMonths must be >= minTenureMonths > 0");
  }
  if (input.minInterestRate < 0 || input.maxInterestRate < input.minInterestRate) {
    throw new Error("Invalid interest rate range");
  }

  const product = await prisma.loanProduct.create({
    data: {
      organizationId,
      code: input.code,
      name: input.name,
      type: input.type,
      description: input.description,
      minAmount: input.minAmount,
      maxAmount: input.maxAmount,
      minTenureMonths: input.minTenureMonths,
      maxTenureMonths: input.maxTenureMonths,
      interestRateType: input.interestRateType ?? "REDUCING_BALANCE",
      minInterestRate: input.minInterestRate,
      maxInterestRate: input.maxInterestRate,
      processingFeePercent: input.processingFeePercent ?? 0,
      processingFeeFlat: input.processingFeeFlat ?? 0,
      latePaymentPenaltyPercent: input.latePaymentPenaltyPercent ?? 0,
      foreclosureAllowed: input.foreclosureAllowed ?? true,
      foreclosureChargePercent: input.foreclosureChargePercent ?? 0,
      partPaymentAllowed: input.partPaymentAllowed ?? true,
      partPaymentChargePercent: input.partPaymentChargePercent ?? 0,
      collateralRequired: input.collateralRequired ?? false,
      eligibilityRules: input.eligibilityRules as unknown as Prisma.InputJsonValue,
    },
  });

  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "loan.product",
    entityId: product.id,
    description: `Created loan product "${product.name}" (${product.type})`,
  });
  return product;
}

export async function updateProduct(
  id: string,
  organizationId: string,
  input: Partial<CreateLoanProductInput> & { isActive?: boolean },
  actor: { userId: string }
) {
  const existing = await getProduct(id, organizationId);
  const updated = await prisma.loanProduct.update({
    where: { id: existing.id },
    data: {
      ...input,
      eligibilityRules: input.eligibilityRules
        ? (input.eligibilityRules as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.product",
    entityId: id,
    description: `Updated loan product "${existing.name}"`,
    oldValue: existing as unknown as Prisma.InputJsonValue,
    newValue: updated as unknown as Prisma.InputJsonValue,
  });
  return updated;
}

export async function deactivateProduct(id: string, organizationId: string, actor: { userId: string }) {
  const existing = await getProduct(id, organizationId);
  const updated = await prisma.loanProduct.update({ where: { id: existing.id }, data: { isActive: false } });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.product",
    entityId: id,
    description: `Deactivated loan product "${existing.name}"`,
  });
  return updated;
}
