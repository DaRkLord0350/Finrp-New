// ============================================================
// FinRP Banking OS — Plaid Integration
// Implements Link token, token exchange, account sync,
// transaction sync, and webhook processing.
// ============================================================

import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto/token-encryption";
import type { PlaidAccountData, PlaidTransactionData } from "../types";

const PLAID_BASE_URL = process.env.PLAID_ENV === "production"
  ? "https://production.plaid.com"
  : process.env.PLAID_ENV === "development"
  ? "https://development.plaid.com"
  : "https://sandbox.plaid.com";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID ?? "";
const PLAID_SECRET = process.env.PLAID_SECRET ?? "";

async function plaidPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${PLAID_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Plaid-Version": "2020-09-14" },
    body: JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      ...body,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Plaid ${endpoint} failed: ${data.error_message ?? res.status}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Create link token for Plaid Link initialization
// ---------------------------------------------------------------------------
export async function createLinkToken(
  userId: string,
  organizationId: string
): Promise<{ linkToken: string; expiration: string }> {
  const data = await plaidPost("/link/token/create", {
    user: { client_user_id: `${organizationId}:${userId}` },
    client_name: "FinRP",
    products: ["transactions"],
    country_codes: ["US", "IN"],
    language: "en",
    webhook: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/plaid`,
  }) as { link_token: string; expiration: string };

  return { linkToken: data.link_token, expiration: data.expiration };
}

// ---------------------------------------------------------------------------
// Exchange public token → access token + item metadata
// ---------------------------------------------------------------------------
export async function exchangePublicToken(
  publicToken: string,
  organizationId: string,
  opts?: {
    institutionName?: string;
    institutionId?: string;
    bankAccountId?: string;
  }
): Promise<{ connectionId: string }> {
  const data = await plaidPost("/item/public_token/exchange", {
    public_token: publicToken,
  }) as { access_token: string; item_id: string };

  const encryptedToken = encrypt(data.access_token);

  // Upsert connection
  const connection = await prisma.bankConnection.upsert({
    where: { organizationId_provider: { organizationId, provider: "MANUAL" } },
    create: {
      organizationId,
      provider: "MANUAL",
      name: opts?.institutionName ?? "Plaid",
      displayName: opts?.institutionName ?? "Plaid Bank",
      accessToken: encryptedToken,
      status: "CONNECTED",
      metadata: { itemId: data.item_id, institutionId: opts?.institutionId, plaidProvider: true },
    },
    update: {
      accessToken: encryptedToken,
      status: "CONNECTED",
      metadata: { itemId: data.item_id, institutionId: opts?.institutionId, plaidProvider: true },
    },
  });

  return { connectionId: connection.id };
}

// ---------------------------------------------------------------------------
// Fetch accounts for a connection
// ---------------------------------------------------------------------------
export async function getAccounts(connectionId: string): Promise<PlaidAccountData[]> {
  const connection = await prisma.bankConnection.findUnique({
    where: { id: connectionId },
    select: { accessToken: true },
  });
  if (!connection?.accessToken) throw new Error("Connection not found");

  const accessToken = decrypt(connection.accessToken);
  const data = await plaidPost("/accounts/get", { access_token: accessToken }) as {
    accounts: PlaidAccountData[];
  };
  return data.accounts;
}

// ---------------------------------------------------------------------------
// Sync balances for all linked accounts
// ---------------------------------------------------------------------------
export async function syncBalances(
  connectionId: string,
  organizationId: string
): Promise<void> {
  const accounts = await getAccounts(connectionId);
  const dbAccounts = await prisma.bankAccount.findMany({
    where: { organizationId, connectionId },
    select: { id: true, metadata: true },
  });

  for (const plaidAcc of accounts) {
    const dbAcc = dbAccounts.find(a => {
      const meta = a.metadata as Record<string, unknown> | null;
      return meta?.plaidAccountId === plaidAcc.account_id;
    });

    if (dbAcc) {
      await prisma.bankAccount.update({
        where: { id: dbAcc.id },
        data: {
          currentBalance: plaidAcc.balances.current ?? 0,
          availableBalance: plaidAcc.balances.available ?? 0,
          lastSyncAt: new Date(),
          lastSyncStatus: "SUCCESS",
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Sync transactions using Plaid /transactions/sync (cursor-based)
// ---------------------------------------------------------------------------
export async function syncTransactions(
  connectionId: string,
  organizationId: string
): Promise<{ added: number; modified: number; removed: number }> {
  const connection = await prisma.bankConnection.findUnique({
    where: { id: connectionId },
    select: { accessToken: true, metadata: true },
  });
  if (!connection?.accessToken) throw new Error("Connection not found");

  const accessToken = decrypt(connection.accessToken);
  const meta = connection.metadata as Record<string, unknown> | null;
  const cursor = meta?.transactionsCursor as string | undefined;

  let hasMore = true;
  let nextCursor = cursor;
  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;

  const dbAccounts = await prisma.bankAccount.findMany({
    where: { organizationId, connectionId },
    select: { id: true, metadata: true },
  });

  while (hasMore) {
    const data = await plaidPost("/transactions/sync", {
      access_token: accessToken,
      cursor: nextCursor,
      count: 250,
    }) as {
      added: PlaidTransactionData[];
      modified: PlaidTransactionData[];
      removed: Array<{ transaction_id: string }>;
      next_cursor: string;
      has_more: boolean;
    };

    for (const txn of data.added) {
      const dbAcc = dbAccounts.find(a => {
        const m = a.metadata as Record<string, unknown> | null;
        return m?.plaidAccountId === txn.account_id;
      });
      if (!dbAcc) continue;

      await upsertPlaidTransaction(txn, dbAcc.id, organizationId);
      totalAdded++;
    }

    for (const txn of data.modified) {
      const dbAcc = dbAccounts.find(a => {
        const m = a.metadata as Record<string, unknown> | null;
        return m?.plaidAccountId === txn.account_id;
      });
      if (!dbAcc) continue;

      await upsertPlaidTransaction(txn, dbAcc.id, organizationId);
      totalModified++;
    }

    for (const removed of data.removed) {
      await prisma.bankTransaction.deleteMany({
        where: { referenceNumber: removed.transaction_id, organizationId },
      });
      totalRemoved++;
    }

    nextCursor = data.next_cursor;
    hasMore = data.has_more;
  }

  // Save cursor for next sync
  await prisma.bankConnection.update({
    where: { id: connectionId },
    data: {
      metadata: { ...(meta ?? {}), transactionsCursor: nextCursor },
      lastSyncAt: new Date(),
      status: "CONNECTED",
    },
  });

  return { added: totalAdded, modified: totalModified, removed: totalRemoved };
}

// ---------------------------------------------------------------------------
// Process Plaid webhook
// ---------------------------------------------------------------------------
export async function processPlaidWebhook(
  payload: Record<string, unknown>,
  organizationId: string
): Promise<void> {
  const webhookType = String(payload.webhook_type ?? "");
  const webhookCode = String(payload.webhook_code ?? "");
  const itemId = String(payload.item_id ?? "");

  if (webhookType !== "TRANSACTIONS") return;

  const connection = await prisma.bankConnection.findFirst({
    where: {
      organizationId,
      metadata: { path: ["itemId"], equals: itemId },
    },
  });
  if (!connection) return;

  if (
    webhookCode === "SYNC_UPDATES_AVAILABLE" ||
    webhookCode === "DEFAULT_UPDATE" ||
    webhookCode === "INITIAL_UPDATE"
  ) {
    await syncTransactions(connection.id, organizationId);
    await syncBalances(connection.id, organizationId);
  }
}

// ---------------------------------------------------------------------------
// Upsert a single Plaid transaction
// ---------------------------------------------------------------------------
async function upsertPlaidTransaction(
  txn: PlaidTransactionData,
  bankAccountId: string,
  organizationId: string
): Promise<void> {
  const amount = txn.amount;
  const isDebit = amount > 0;

  const category = txn.personal_finance_category?.primary
    ?? (txn.transaction_type === "special" ? "Bank Charges" : undefined);

  await prisma.bankTransaction.upsert({
    where: {
      id: `plaid-${txn.transaction_id}`,
    },
    create: {
      id: `plaid-${txn.transaction_id}`,
      organizationId,
      bankAccountId,
      transactionDate: new Date(txn.date),
      valueDate: txn.authorized_date ? new Date(txn.authorized_date) : null,
      narration: txn.name,
      referenceNumber: txn.transaction_id,
      debit: isDebit ? Math.abs(amount) : null,
      credit: isDebit ? null : Math.abs(amount),
      category: category ?? null,
      source: "MANUAL",
      status: txn.pending ? "UNREVIEWED" : "UNREVIEWED",
      metadata: { plaidMerchantName: txn.merchant_name, plaidCategory: txn.personal_finance_category },
    },
    update: {
      transactionDate: new Date(txn.date),
      narration: txn.name,
      debit: isDebit ? Math.abs(amount) : null,
      credit: isDebit ? null : Math.abs(amount),
      category: category ?? undefined,
    },
  });
}
