// ============================================================
// FinRP Banking OS — Consent Service
// Persistence + lifecycle orchestration for AA consents.
// Sits between API routes/webhooks and the BankingProvider:
//   initiateConsent     create at provider + BankConsent row
//   refreshConsentStatus poll provider, update row, link accounts
//   revokeConsent        revoke at provider + row + audit
// All writes are tenant-scoped and audit-logged.
// ============================================================

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { createBankingLogger } from "./logger";
import { getBankingProvider } from "./providers";
import type { ConsentStatus } from "@prisma/client";
import type { DiscoveredAccount } from "./providers/types";

const log = createBankingLogger("consent-service");

/** Mask a VUA/phone before persisting — we never store the full handle. */
function maskVua(vua?: string): string | null {
  if (!vua) return null;
  const [local, handle] = vua.split("@");
  if (!local) return null;
  const visible = local.slice(-2);
  return `${"X".repeat(Math.max(local.length - 2, 2))}${visible}${handle ? `@${handle}` : ""}`;
}

// ---------------------------------------------------------------------------
// Initiate a new consent (Connect Bank entry point)
// ---------------------------------------------------------------------------
export async function initiateConsent(opts: {
  organizationId: string;
  createdById?: string;
  bankAccountId?: string;
  vua?: string;
  dataRange?: { from: Date; to: Date };
  redirectUrl?: string;
}): Promise<{ consentDbId: string; consentId: string; redirectUrl: string }> {
  const provider = getBankingProvider("SETU");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUrl = opts.redirectUrl ?? `${appUrl}/api/banking/setu/callback`;

  const now = new Date();
  const from = opts.dataRange?.from ?? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const to = opts.dataRange?.to ?? now;

  const result = await provider.createConsent({
    organizationId: opts.organizationId,
    vua: opts.vua,
    redirectUrl,
    dataRange: { from, to },
  });

  const record = await prisma.bankConsent.create({
    data: {
      organizationId: opts.organizationId,
      bankAccountId: opts.bankAccountId ?? null,
      provider: "SETU",
      consentId: result.consentId,
      consentHandle: result.consentId, // v2 API: single id serves both roles
      status: "PENDING",
      startDate: from,
      endDate: to,
      consentType: "TRANSACTIONS",
      fiTypes: ["DEPOSIT"],
      vua: maskVua(opts.vua),
      redirectUrl: result.redirectUrl,
      createdById: opts.createdById ?? null,
      metadata: { providerResponse: result.raw as object },
    },
  });

  await createAuditLog({
    organizationId: opts.organizationId,
    userId: opts.createdById,
    action: "CREATE",
    entity: "BankConsent",
    entityId: record.id,
    description: `Initiated Setu AA consent ${result.consentId}`,
  });

  log.info("consent initiated", { consentDbId: record.id, consentId: result.consentId, organizationId: opts.organizationId });
  return { consentDbId: record.id, consentId: result.consentId, redirectUrl: result.redirectUrl };
}

// ---------------------------------------------------------------------------
// Refresh consent status from the provider and update the row.
// Returns the updated DB record (or null when we don't know this consent).
// ---------------------------------------------------------------------------
export async function refreshConsentStatus(providerConsentId: string) {
  const existing = await prisma.bankConsent.findFirst({
    where: {
      OR: [{ consentId: providerConsentId }, { consentHandle: providerConsentId }],
      deletedAt: null,
    },
  });
  if (!existing) {
    log.warn("refreshConsentStatus: unknown consent", { consentId: providerConsentId });
    return null;
  }

  const provider = getBankingProvider(existing.provider);
  const statusResult = await provider.getConsentStatus(providerConsentId);

  const lifecycle: { approvedAt?: Date; rejectedAt?: Date; revokedAt?: Date } = {};
  if (statusResult.status === "ACTIVE" && !existing.approvedAt) lifecycle.approvedAt = new Date();
  if (statusResult.status === "REJECTED" && !existing.rejectedAt) lifecycle.rejectedAt = new Date();
  if (statusResult.status === "REVOKED" && !existing.revokedAt) lifecycle.revokedAt = new Date();

  const updated = await prisma.bankConsent.update({
    where: { id: existing.id },
    data: {
      status: statusResult.status as ConsentStatus,
      consentId: statusResult.consentId,
      ...lifecycle,
    },
  });

  // Link any accounts the user connected during approval.
  if (statusResult.status === "ACTIVE" && statusResult.linkedAccounts.length > 0) {
    await linkDiscoveredAccounts(existing.organizationId, existing.id, statusResult.linkedAccounts);
  }

  log.info("consent status refreshed", { consentDbId: existing.id, status: statusResult.status });
  return updated;
}

// ---------------------------------------------------------------------------
// Upsert BankAccount rows for accounts discovered under a consent.
// Returns the affected bank account ids.
// ---------------------------------------------------------------------------
export async function linkDiscoveredAccounts(
  organizationId: string,
  consentDbId: string,
  accounts: DiscoveredAccount[]
): Promise<string[]> {
  const ids: string[] = [];

  for (const acc of accounts) {
    const existing = await prisma.bankAccount.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { linkedAccountRef: acc.linkRefNumber },
          ...(acc.maskedAccNumber ? [{ maskedNumber: acc.maskedAccNumber }] : []),
        ],
      },
      select: { id: true, linkedAccountRef: true },
    });

    if (existing) {
      if (!existing.linkedAccountRef) {
        await prisma.bankAccount.update({
          where: { id: existing.id },
          data: { linkedAccountRef: acc.linkRefNumber, consentStatus: "ACTIVE" },
        });
      }
      ids.push(existing.id);
      continue;
    }

    const created = await prisma.bankAccount.create({
      data: {
        organizationId,
        accountName: acc.fipName ? `${acc.fipName} ${acc.maskedAccNumber}` : acc.maskedAccNumber,
        bankName: acc.fipName ?? "Linked Bank",
        accountNumber: acc.maskedAccNumber,
        maskedNumber: acc.maskedAccNumber,
        accountType: acc.accountType?.toUpperCase() === "SAVINGS" ? "SAVINGS" : "CURRENT",
        linkedAccountRef: acc.linkRefNumber,
        consentStatus: "ACTIVE",
        autoSyncEnabled: true,
        metadata: { fipId: acc.fipId, fiType: acc.fiType, discoveredVia: "AA_CONSENT" },
      },
      select: { id: true },
    });
    ids.push(created.id);
    log.info("bank account discovered via AA", { bankAccountId: created.id, organizationId });
  }

  // Attach the consent to the account when it was created account-less
  // and exactly one account came back.
  if (ids.length === 1) {
    await prisma.bankConsent.updateMany({
      where: { id: consentDbId, bankAccountId: null },
      data: { bankAccountId: ids[0] },
    });
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Revoke a consent (customer-initiated, or explicitly granted CA)
// ---------------------------------------------------------------------------
export async function revokeConsent(opts: {
  consentDbId: string;
  organizationId: string;
  userId?: string;
}): Promise<void> {
  const consent = await prisma.bankConsent.findFirst({
    where: { id: opts.consentDbId, organizationId: opts.organizationId, deletedAt: null },
  });
  if (!consent) throw new Error("Consent not found");
  if (!consent.consentId) throw new Error("Consent has no provider id");

  const provider = getBankingProvider(consent.provider);
  await provider.revokeConsent(consent.consentId);

  await prisma.bankConsent.update({
    where: { id: consent.id },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  if (consent.bankAccountId) {
    await prisma.bankAccount.update({
      where: { id: consent.bankAccountId },
      data: { consentStatus: "REVOKED", autoSyncEnabled: false },
    }).catch(() => {});
  }

  await createAuditLog({
    organizationId: opts.organizationId,
    userId: opts.userId,
    action: "DELETE",
    entity: "BankConsent",
    entityId: consent.id,
    description: `Revoked Setu AA consent ${consent.consentId}`,
  });

  log.info("consent revoked", { consentDbId: consent.id, organizationId: opts.organizationId });
}
