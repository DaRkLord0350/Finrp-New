// ============================================================
// lib/lending/collateral.ts
// Collateral management for secured loan products.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { CollateralType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "./workflow/service";

export interface AddCollateralInput {
  type: CollateralType;
  description: string;
  estimatedValue: number;
  ownershipDocRef?: string;
}

export async function addCollateral(
  applicationId: string,
  organizationId: string,
  input: AddCollateralInput,
  actor: { userId: string }
) {
  const app = await workflow.getApplication(applicationId, organizationId);
  const collateral = await prisma.loanCollateral.create({
    data: {
      applicationId: app.id,
      organizationId,
      type: input.type,
      description: input.description,
      estimatedValue: input.estimatedValue,
      ownershipDocRef: input.ownershipDocRef,
      status: "PENDING_VALUATION",
    },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "loan.collateral",
    entityId: collateral.id,
    description: `Added ${input.type} collateral (est. ₹${input.estimatedValue}) to loan application ${app.applicationNumber}`,
  });
  return collateral;
}

export async function recordValuation(
  collateralId: string,
  organizationId: string,
  input: { estimatedValue: number; valuedBy: string },
  actor: { userId: string }
) {
  const collateral = await prisma.loanCollateral.findFirst({ where: { id: collateralId, organizationId } });
  if (!collateral) throw new workflow.LoanNotFoundError("Collateral not found");

  const updated = await prisma.loanCollateral.update({
    where: { id: collateral.id },
    data: { estimatedValue: input.estimatedValue, valuedBy: input.valuedBy, valuationDate: new Date(), status: "VALUED" },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.collateral",
    entityId: collateral.id,
    description: `Valued collateral at ₹${input.estimatedValue} (valuer: ${input.valuedBy})`,
  });
  return updated;
}

export async function markLienMarked(
  collateralId: string,
  organizationId: string,
  lienReferenceNumber: string,
  actor: { userId: string }
) {
  const collateral = await prisma.loanCollateral.findFirst({ where: { id: collateralId, organizationId } });
  if (!collateral) throw new workflow.LoanNotFoundError("Collateral not found");
  if (collateral.status !== "VALUED") {
    throw new workflow.LoanWorkflowError("Collateral must be VALUED before a lien can be marked");
  }

  const updated = await prisma.loanCollateral.update({
    where: { id: collateral.id },
    data: { lienMarked: true, lienReferenceNumber, status: "LIEN_MARKED" },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.collateral",
    entityId: collateral.id,
    description: `Lien marked (ref ${lienReferenceNumber})`,
  });
  return updated;
}

export async function releaseCollateral(collateralId: string, organizationId: string, actor: { userId: string }) {
  const collateral = await prisma.loanCollateral.findFirst({ where: { id: collateralId, organizationId } });
  if (!collateral) throw new workflow.LoanNotFoundError("Collateral not found");

  const updated = await prisma.loanCollateral.update({ where: { id: collateral.id }, data: { status: "RELEASED" } });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.collateral",
    entityId: collateral.id,
    description: "Collateral released",
  });
  return updated;
}

export async function listCollateral(applicationId: string, organizationId: string) {
  await workflow.getApplication(applicationId, organizationId);
  return prisma.loanCollateral.findMany({ where: { applicationId, organizationId }, orderBy: { createdAt: "desc" } });
}
