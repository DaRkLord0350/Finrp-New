// ============================================================
// lib/lending/collections.ts
// DPD (days-past-due) bucketing, collection case lifecycle, and NPA
// staging. syncCollectionCases is the core scan run by the
// collections-sync Inngest cron (inngest/functions/lending.ts).
// ============================================================

import { prisma } from "@/lib/prisma";
import type { CollectionActivityType, CollectionBucket } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "./workflow/service";
import { D, round2 } from "./core/money";

export function computeDpdBucket(overdueDays: number): CollectionBucket {
  if (overdueDays <= 0) return "CURRENT";
  if (overdueDays <= 30) return "DPD_1_30";
  if (overdueDays <= 60) return "DPD_31_60";
  if (overdueDays <= 90) return "DPD_61_90";
  return "DPD_90_PLUS";
}

/** RBI convention: principal/interest overdue > 90 days -> Non-Performing Asset. */
function isNpa(overdueDays: number): boolean {
  return overdueDays > 90;
}

/**
 * Scans every ACTIVE loan account for overdue EMIs, opens/updates a
 * LoanCollectionCase per account in arrears, and flags NPA status once
 * overdue crosses 90 days. Safe to run repeatedly (upserts by account).
 */
export async function syncCollectionCases(organizationId: string) {
  const today = new Date();
  const accounts = await prisma.loanAccount.findMany({
    where: { organizationId, status: { in: ["ACTIVE", "NPA_SUBSTANDARD", "NPA_DOUBTFUL"] }, nextDueDate: { lt: today } },
  });

  const results: { loanAccountId: string; bucket: CollectionBucket; overdueDays: number }[] = [];

  for (const account of accounts) {
    const overdueDays = account.nextDueDate ? Math.floor((today.getTime() - account.nextDueDate.getTime()) / 86_400_000) : 0;
    if (overdueDays <= 0) continue;
    const bucket = computeDpdBucket(overdueDays);
    const overdueAmount = account.nextDueAmount ?? D(0);

    const existingCase = await prisma.loanCollectionCase.findFirst({
      where: { loanAccountId: account.id, status: { in: ["OPEN", "IN_PROGRESS", "PROMISE_TO_PAY", "ESCALATED"] } },
    });

    if (existingCase) {
      await prisma.loanCollectionCase.update({
        where: { id: existingCase.id },
        data: { bucket, overdueDays, overdueAmount: overdueAmount.toString() },
      });
    } else {
      await prisma.loanCollectionCase.create({
        data: {
          loanAccountId: account.id,
          organizationId,
          bucket,
          overdueAmount: overdueAmount.toString(),
          overdueDays,
          status: "OPEN",
        },
      });
    }

    if (isNpa(overdueDays) && !account.status.startsWith("NPA")) {
      await prisma.loanAccount.update({
        where: { id: account.id },
        data: { status: "NPA_SUBSTANDARD", npaFlaggedAt: account.npaFlaggedAt ?? today, npaDays: overdueDays },
      });
      await createAuditLog({
        organizationId,
        action: "UPDATE",
        entity: "loan.account",
        entityId: account.id,
        description: `Loan account ${account.accountNumber} flagged NPA — ${overdueDays} days past due`,
      });
    } else if (account.status.startsWith("NPA")) {
      await prisma.loanAccount.update({ where: { id: account.id }, data: { npaDays: overdueDays } });
    }

    results.push({ loanAccountId: account.id, bucket, overdueDays });
  }

  return results;
}

export async function recordCollectionActivity(
  caseId: string,
  organizationId: string,
  input: { activityType: CollectionActivityType; notes?: string; outcome?: string },
  actor: { userId: string }
) {
  const collectionCase = await prisma.loanCollectionCase.findFirst({ where: { id: caseId, organizationId } });
  if (!collectionCase) throw new workflow.LoanNotFoundError("Collection case not found");

  const activity = await prisma.loanCollectionActivity.create({
    data: {
      caseId: collectionCase.id,
      activityType: input.activityType,
      notes: input.notes,
      outcome: input.outcome,
      performedById: actor.userId,
    },
  });

  await prisma.loanCollectionCase.update({
    where: { id: collectionCase.id },
    data: {
      lastContactedAt: new Date(),
      status: input.activityType === "PAYMENT_PROMISE" ? "PROMISE_TO_PAY" : collectionCase.status === "OPEN" ? "IN_PROGRESS" : undefined,
    },
  });

  return activity;
}

export async function assignCase(caseId: string, organizationId: string, assignedToId: string, actor: { userId: string }) {
  const collectionCase = await prisma.loanCollectionCase.findFirst({ where: { id: caseId, organizationId } });
  if (!collectionCase) throw new workflow.LoanNotFoundError("Collection case not found");
  const updated = await prisma.loanCollectionCase.update({ where: { id: collectionCase.id }, data: { assignedToId } });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.collection_case",
    entityId: collectionCase.id,
    description: `Assigned collection case to user ${assignedToId}`,
  });
  return updated;
}

export async function resolveCase(caseId: string, organizationId: string, actor: { userId: string }) {
  const collectionCase = await prisma.loanCollectionCase.findFirst({ where: { id: caseId, organizationId } });
  if (!collectionCase) throw new workflow.LoanNotFoundError("Collection case not found");
  const updated = await prisma.loanCollectionCase.update({ where: { id: collectionCase.id }, data: { status: "RESOLVED" } });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.collection_case",
    entityId: collectionCase.id,
    description: "Collection case resolved",
  });
  return updated;
}

export async function escalateCase(caseId: string, organizationId: string, actor: { userId: string }) {
  const collectionCase = await prisma.loanCollectionCase.findFirst({ where: { id: caseId, organizationId } });
  if (!collectionCase) throw new workflow.LoanNotFoundError("Collection case not found");
  const updated = await prisma.loanCollectionCase.update({ where: { id: collectionCase.id }, data: { status: "ESCALATED" } });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "UPDATE",
    entity: "loan.collection_case",
    entityId: collectionCase.id,
    description: "Collection case escalated",
  });
  return updated;
}

export async function listCollectionCases(
  organizationId: string,
  filters: { status?: string; bucket?: CollectionBucket; assignedToId?: string } = {}
) {
  return prisma.loanCollectionCase.findMany({
    where: {
      organizationId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.bucket ? { bucket: filters.bucket } : {}),
      ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
    },
    include: { loanAccount: { include: { customer: true } }, assignedTo: true, activities: { orderBy: { performedAt: "desc" }, take: 5 } },
    orderBy: { overdueDays: "desc" },
  });
}

export function summarizePortfolioByBucket(cases: { bucket: CollectionBucket; overdueAmount: unknown }[]) {
  const buckets: Record<CollectionBucket, { count: number; amount: string }> = {
    CURRENT: { count: 0, amount: "0" },
    DPD_1_30: { count: 0, amount: "0" },
    DPD_31_60: { count: 0, amount: "0" },
    DPD_61_90: { count: 0, amount: "0" },
    DPD_90_PLUS: { count: 0, amount: "0" },
    NPA: { count: 0, amount: "0" },
  };
  for (const c of cases) {
    buckets[c.bucket].count += 1;
    buckets[c.bucket].amount = round2(D(buckets[c.bucket].amount).plus(D((c.overdueAmount as { toString(): string }).toString()))).toString();
  }
  return buckets;
}
