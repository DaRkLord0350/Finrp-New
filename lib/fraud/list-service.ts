// ============================================================
// lib/fraud/list-service.ts
// Blacklist / whitelist CRUD + the lookup used by the screening
// service. A whitelist hit does not currently short-circuit scoring —
// it is surfaced to the case reviewer as context (e.g. "this PAN is
// whitelisted") rather than silently skipping checks, since an
// org-level whitelist entry should inform a human, not bypass fraud
// controls automatically.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { FraudListEntryType, FraudListType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import * as workflow from "@/lib/lending/workflow/service";

export interface AddListEntryInput {
  listType: FraudListType;
  entryType: FraudListEntryType;
  value: string;
  reason?: string;
  expiresAt?: string;
}

export async function addListEntry(organizationId: string, input: AddListEntryInput, actor: { userId: string }) {
  const entry = await prisma.fraudListEntry.upsert({
    where: { organizationId_listType_entryType_value: { organizationId, listType: input.listType, entryType: input.entryType, value: input.value } },
    create: {
      organizationId,
      listType: input.listType,
      entryType: input.entryType,
      value: input.value,
      reason: input.reason,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      addedById: actor.userId,
    },
    update: { reason: input.reason, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined },
  });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "CREATE",
    entity: "fraud.list_entry",
    entityId: entry.id,
    description: `Added ${input.entryType} to ${input.listType.toLowerCase()}: ${input.value}`,
  });
  return entry;
}

export async function removeListEntry(entryId: string, organizationId: string, actor: { userId: string }) {
  const entry = await prisma.fraudListEntry.findFirst({ where: { id: entryId, organizationId } });
  if (!entry) throw new workflow.LoanNotFoundError("List entry not found");
  await prisma.fraudListEntry.delete({ where: { id: entry.id } });
  await createAuditLog({
    organizationId,
    userId: actor.userId,
    action: "DELETE",
    entity: "fraud.list_entry",
    entityId: entry.id,
    description: `Removed ${entry.entryType} from ${entry.listType.toLowerCase()}: ${entry.value}`,
  });
}

export async function listEntries(organizationId: string, listType?: FraudListType) {
  return prisma.fraudListEntry.findMany({
    where: { organizationId, ...(listType ? { listType } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export interface BlacklistCheckInput {
  pan?: string;
  aadhaarHash?: string;
  email?: string;
  phone?: string;
  deviceFingerprint?: string;
  ipAddress?: string;
}

export async function checkBlacklist(organizationId: string, input: BlacklistCheckInput): Promise<boolean> {
  const values: { entryType: FraudListEntryType; value: string }[] = [];
  if (input.pan) values.push({ entryType: "PAN", value: input.pan });
  if (input.aadhaarHash) values.push({ entryType: "AADHAAR_HASH", value: input.aadhaarHash });
  if (input.email) values.push({ entryType: "EMAIL", value: input.email });
  if (input.phone) values.push({ entryType: "PHONE", value: input.phone });
  if (input.deviceFingerprint) values.push({ entryType: "DEVICE_FINGERPRINT", value: input.deviceFingerprint });
  if (input.ipAddress) values.push({ entryType: "IP_ADDRESS", value: input.ipAddress });
  if (values.length === 0) return false;

  const now = new Date();
  const hit = await prisma.fraudListEntry.findFirst({
    where: {
      organizationId,
      listType: "BLACKLIST",
      OR: values.map((v) => ({ entryType: v.entryType, value: v.value })),
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
  });
  return Boolean(hit);
}
