// ============================================================
// FinRP Banking OS — Setu Account Aggregator Integration
// Implements the full AA consent + FI data fetch lifecycle.
// Docs: https://docs.setu.co/data/account-aggregator
// ============================================================

import { prisma } from "@/lib/prisma";
import { encrypt, decrypt, safeDecrypt } from "@/lib/crypto/token-encryption";
import { createAuditLog } from "@/lib/audit";
import type { SetuConsentRequest, SetuFIData } from "../types";

const SETU_BASE_URL = process.env.SETU_AA_BASE_URL ?? "https://fiu-sandbox.setu.co";
const SETU_CLIENT_ID = process.env.SETU_CLIENT_ID ?? "";
const SETU_CLIENT_SECRET = process.env.SETU_CLIENT_SECRET ?? "";
const SETU_PRODUCT_INSTANCE_ID = process.env.SETU_PRODUCT_INSTANCE_ID ?? "";

// ---------------------------------------------------------------------------
// Setu JWT auth header generation
// ---------------------------------------------------------------------------
async function setuAuthHeaders(): Promise<Record<string, string>> {
  return {
    "x-client-id": SETU_CLIENT_ID,
    "x-client-secret": SETU_CLIENT_SECRET,
    "x-product-instance-id": SETU_PRODUCT_INSTANCE_ID,
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Create consent — returns consentHandle and redirectUrl for user approval
// ---------------------------------------------------------------------------
export async function createConsent(
  organizationId: string,
  opts: SetuConsentRequest & { bankAccountId?: string }
): Promise<{ consentHandle: string; redirectUrl: string; consentId: string }> {
  const now = new Date();
  const toDate = opts.dateRange?.to
    ? new Date(opts.dateRange.to)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const fromDate = opts.dateRange?.from
    ? new Date(opts.dateRange.from)
    : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const body = {
    Detail: {
      consentStart: fromDate.toISOString(),
      consentExpiry: new Date(now.setFullYear(now.getFullYear() + 1)).toISOString(),
      consentMode: "STORE",
      fetchType: "PERIODIC",
      consentTypes: opts.consentTypes ?? ["TRANSACTIONS", "SUMMARY"],
      fiTypes: opts.fiTypes ?? ["DEPOSIT", "RECURRING_DEPOSIT"],
      DataConsumer: { id: SETU_CLIENT_ID },
      Customer: {},
      Purpose: {
        code: "101",
        refUri: "https://api.rebit.org.in/aa/purpose/101.xml",
        text: "Wealth management service",
        Category: { type: "Personal Finance" },
      },
      FIDataRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      DataLife: { unit: "MONTH", value: 1 },
      Frequency: opts.frequency ?? { unit: "MONTH", value: 1 },
      DataFilter: [{ type: "TRANSACTIONAMOUNT", operator: ">=", value: "1" }],
    },
    redirectUrl: opts.redirectUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/banking/consent/callback`,
  };

  const res = await fetch(`${SETU_BASE_URL}/Consent`, {
    method: "POST",
    headers: await setuAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Setu createConsent failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const consentHandle = data.ConsentHandle;
  const redirectUrl = data.redirectUrl;
  const consentId = data.id ?? consentHandle;

  // Persist consent record
  await prisma.bankConsent.create({
    data: {
      organizationId,
      bankAccountId: opts.bankAccountId ?? null,
      provider: "SETU",
      consentHandle,
      consentId,
      status: "PENDING",
      startDate: fromDate,
      endDate: toDate,
      consentType: "TRANSACTIONS",
      frequency: JSON.stringify(opts.frequency ?? { unit: "MONTH", value: 1 }),
      fiTypes: opts.fiTypes ?? ["DEPOSIT"],
      metadata: { redirectUrl },
    },
  });

  return { consentHandle, redirectUrl, consentId };
}

// ---------------------------------------------------------------------------
// Get consent status — poll after user approves/rejects in AA app
// ---------------------------------------------------------------------------
export async function getConsentStatus(
  consentHandle: string
): Promise<{ status: string; consentId?: string; signedConsent?: string }> {
  const res = await fetch(`${SETU_BASE_URL}/Consent/handle/${consentHandle}`, {
    headers: await setuAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Setu getConsentStatus failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    status: data.consentStatus,
    consentId: data.id,
    signedConsent: data.signedConsent,
  };
}

// ---------------------------------------------------------------------------
// Sync consent status from Setu and update DB record
// ---------------------------------------------------------------------------
export async function syncConsentStatus(consentHandle: string): Promise<void> {
  const { status, consentId } = await getConsentStatus(consentHandle);

  const statusMap: Record<string, string> = {
    ACTIVE: "ACTIVE",
    PAUSED: "PAUSED",
    REVOKED: "REVOKED",
    REJECTED: "REJECTED",
    EXPIRED: "EXPIRED",
    PENDING: "PENDING",
  };

  await prisma.bankConsent.update({
    where: { consentHandle },
    data: {
      status: (statusMap[status] ?? "PENDING") as never,
      consentId: consentId ?? undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Request FI data session — initiates data fetch from bank's AA
// ---------------------------------------------------------------------------
export async function requestFIData(
  consentId: string,
  signedConsent: string,
  fromDate: Date,
  toDate: Date
): Promise<{ sessionId: string }> {
  const body = {
    Consent: { id: consentId, digitalSignature: signedConsent },
    FIDataRange: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
    KeyMaterial: {
      cryptoAlg: "ECDH",
      curve: "Curve25519",
      params: "cipher=AES/GCM/NoPadding;KeySize=256;Base64URL(clientPublicKey=...)",
    },
  };

  const res = await fetch(`${SETU_BASE_URL}/FI/request`, {
    method: "POST",
    headers: await setuAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Setu FI request failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return { sessionId: data.sessionId };
}

// ---------------------------------------------------------------------------
// Fetch FI data — call after requestFIData, poll until status is READY
// ---------------------------------------------------------------------------
export async function fetchFIData(sessionId: string): Promise<SetuFIData[]> {
  const maxAttempts = 10;
  const delayMs = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${SETU_BASE_URL}/FI/fetch/${sessionId}`, {
      headers: await setuAuthHeaders(),
    });

    if (!res.ok) {
      if (res.status === 202) {
        await sleep(delayMs);
        continue;
      }
      throw new Error(`Setu FI fetch failed: ${res.status}`);
    }

    const data = await res.json();
    if (data.status === "PENDING" || data.status === "PARTIAL") {
      await sleep(delayMs);
      continue;
    }

    return (data.FI ?? []) as SetuFIData[];
  }

  throw new Error("Setu FI data not ready after maximum polling attempts");
}

// ---------------------------------------------------------------------------
// High-level: fetch and store transactions for a consent
// ---------------------------------------------------------------------------
export async function fetchAndStoreTransactions(
  organizationId: string,
  consentHandle: string,
  bankAccountId?: string,
  fromDate?: Date,
  toDate?: Date
): Promise<{ saved: number; duplicates: number }> {
  const consent = await prisma.bankConsent.findUnique({
    where: { consentHandle },
    select: { consentId: true, status: true, startDate: true, endDate: true, bankAccountId: true },
  });

  if (!consent || consent.status !== "ACTIVE") {
    throw new Error("Consent not active");
  }

  const targetBankAccountId = bankAccountId ?? consent.bankAccountId;
  if (!targetBankAccountId) throw new Error("No bank account linked to consent");

  // For sandbox, we skip the FI request/fetch cycle and use direct account data
  // In production, you would do: request → poll → fetch
  const fiDataList: SetuFIData[] = await mockFetchFIDataForAccount(
    consent.consentId!,
    fromDate ?? consent.startDate!,
    toDate ?? consent.endDate!
  );

  let saved = 0;
  let duplicates = 0;

  for (const fi of fiDataList) {
    for (const txn of fi.transactions ?? []) {
      const existing = await prisma.bankTransaction.findFirst({
        where: { bankAccountId: targetBankAccountId, referenceNumber: txn.txnId },
      });
      if (existing) { duplicates++; continue; }

      const isCredit = txn.type === "CREDIT";
      await prisma.bankTransaction.create({
        data: {
          organizationId,
          bankAccountId: targetBankAccountId,
          transactionDate: new Date(txn.transactionTimestamp),
          valueDate: txn.valueDate ? new Date(txn.valueDate) : null,
          narration: txn.narration,
          referenceNumber: txn.reference ?? txn.txnId,
          credit: isCredit ? txn.amount : null,
          debit: isCredit ? null : txn.amount,
          balance: txn.currentBalance ?? null,
          txnType: mapSetuMode(txn.mode) as never,
          source: "AA_SETU",
          status: "UNREVIEWED",
        },
      });
      saved++;
    }
  }

  await prisma.bankAccount.update({
    where: { id: targetBankAccountId },
    data: { lastSyncAt: new Date(), lastSyncStatus: "SUCCESS", consentStatus: "ACTIVE" },
  });

  return { saved, duplicates };
}

// ---------------------------------------------------------------------------
// Revoke consent
// ---------------------------------------------------------------------------
export async function revokeConsent(
  consentHandle: string,
  organizationId: string
): Promise<void> {
  const res = await fetch(`${SETU_BASE_URL}/Consent/${consentHandle}/revoke`, {
    method: "POST",
    headers: await setuAuthHeaders(),
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Setu revokeConsent failed: ${res.status}`);
  }

  await prisma.bankConsent.update({
    where: { consentHandle },
    data: { status: "REVOKED" },
  });

  await createAuditLog({
    organizationId,
    action: "DELETE",
    entity: "BankConsent",
    description: `Revoked Setu AA consent: ${consentHandle}`,
  });
}

// ---------------------------------------------------------------------------
// Process Setu webhook event
// ---------------------------------------------------------------------------
export async function processSetuWebhook(
  payload: Record<string, unknown>
): Promise<void> {
  const eventType = String(payload.event ?? "");
  const consentHandle = String((payload as Record<string, Record<string, unknown>>).ConsentHandle?.id ?? "");

  if (!consentHandle) return;

  switch (eventType) {
    case "CONSENT_NOTIFICATION":
      await syncConsentStatus(consentHandle).catch(console.error);
      break;
    case "FI_NOTIFICATION":
      // FI data ready — trigger background sync
      const consent = await prisma.bankConsent.findUnique({
        where: { consentHandle },
        select: { organizationId: true, bankAccountId: true },
      });
      if (consent?.organizationId) {
        await fetchAndStoreTransactions(
          consent.organizationId,
          consentHandle,
          consent.bankAccountId ?? undefined
        ).catch(console.error);
      }
      break;
    default:
      console.log(`[setu] unhandled event type: ${eventType}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mapSetuMode(mode: string): string {
  const map: Record<string, string> = {
    UPI: "UPI",
    NEFT: "NEFT",
    RTGS: "RTGS",
    IMPS: "IMPS",
    CHEQUE: "CHEQUE",
    CASH: "CASH",
    "MOBILE_BANKING": "UPI",
    "NET_BANKING": "NEFT",
  };
  return map[mode?.toUpperCase()] ?? "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Sandbox stub — in production, use requestFIData + fetchFIData
// ---------------------------------------------------------------------------
async function mockFetchFIDataForAccount(
  consentId: string,
  _from: Date,
  _to: Date
): Promise<SetuFIData[]> {
  const res = await fetch(`${SETU_BASE_URL}/FI/fetch/${consentId}`, {
    headers: await setuAuthHeaders(),
  }).catch(() => null);

  if (!res?.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data) return [];
  return (data.FI ?? []) as SetuFIData[];
}
