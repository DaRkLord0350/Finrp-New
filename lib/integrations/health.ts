// ============================================================
// lib/integrations/health.ts
//
// Normalizes connection health across every audited integration
// (excludes Razorpay — billing has its own dedicated surface) into one
// shape for the /integrations/health page. Each provider is sourced
// from whatever model actually backs it today:
//   • Zoho CRM/Books/Inventory → Integration rows (OAuth connectors)
//   • Setu / Plaid             → BankConnection + linked BankAccount rows
//   • Resend                   → emailConfigStatus() (API-key based, no OAuth)
//   • Clerk                    → env-var presence (platform auth layer)
//   • Supabase Storage, Dwolla → not wired; static rows, no manage action
// ============================================================

import { prisma } from "@/lib/prisma";
import { emailConfigStatus } from "@/lib/notifications/email";

export type IntegrationHealthStatus = "healthy" | "error" | "not_configured" | "unavailable";

export interface IntegrationHealthRow {
  key: string;
  name: string;
  category: string;
  connected: boolean;
  status: IntegrationHealthStatus;
  lastSyncAt: Date | null;
  errorDetails: string | null;
  manageHref: string | null;
}

async function getZohoRows(organizationId: string): Promise<IntegrationHealthRow[]> {
  const rows = await prisma.integration.findMany({
    where: {
      organizationId,
      deletedAt: null,
      type: { in: ["ZOHO_CRM", "ZOHO_BOOKS", "ZOHO_INVENTORY"] },
    },
    select: { type: true, status: true, lastSyncAt: true, lastSyncError: true },
  });

  const byType = new Map(rows.map((r) => [r.type, r]));
  const labels: Record<string, string> = {
    ZOHO_CRM: "Zoho CRM",
    ZOHO_BOOKS: "Zoho Books",
    ZOHO_INVENTORY: "Zoho Inventory",
  };

  return (["ZOHO_CRM", "ZOHO_BOOKS", "ZOHO_INVENTORY"] as const).map((type) => {
    const row = byType.get(type);
    return {
      key: type.toLowerCase(),
      name: labels[type],
      category: "Connectors",
      connected: row?.status === "ACTIVE" || row?.status === "SYNCING",
      status: !row || row.status === "INACTIVE" ? "not_configured" : row.status === "ERROR" || row.status === "EXPIRED" ? "error" : "healthy",
      lastSyncAt: row?.lastSyncAt ?? null,
      errorDetails: row?.lastSyncError ?? null,
      manageHref: "/integrations/zoho",
    } satisfies IntegrationHealthRow;
  });
}

async function getBankProviderRow(
  organizationId: string,
  opts: { key: string; name: string; provider: "SETU_AA" | "MANUAL"; requirePlaid?: boolean; manageHref: string }
): Promise<IntegrationHealthRow> {
  const connection = await prisma.bankConnection.findFirst({
    where: {
      organizationId,
      provider: opts.provider,
      ...(opts.requirePlaid ? { metadata: { path: ["plaidProvider"], equals: true } } : {}),
    },
  });

  if (!connection) {
    return {
      key: opts.key,
      name: opts.name,
      category: "Banking",
      connected: false,
      status: "not_configured",
      lastSyncAt: null,
      errorDetails: null,
      manageHref: opts.manageHref,
    };
  }

  const accounts = await prisma.bankAccount.findMany({
    where: { connectionId: connection.id },
    select: { lastSyncAt: true, lastSyncError: true, lastSyncStatus: true },
  });

  const lastSyncAt = accounts.reduce<Date | null>((latest, acc) => {
    if (!acc.lastSyncAt) return latest;
    if (!latest || acc.lastSyncAt > latest) return acc.lastSyncAt;
    return latest;
  }, connection.lastSyncAt ?? null);

  const errorDetails = accounts.find((a) => a.lastSyncStatus === "FAILED")?.lastSyncError ?? null;

  return {
    key: opts.key,
    name: opts.name,
    category: "Banking",
    connected: connection.status === "CONNECTED",
    status:
      connection.status === "ERROR" || errorDetails
        ? "error"
        : connection.status === "CONNECTED"
          ? "healthy"
          : "not_configured",
    lastSyncAt,
    errorDetails,
    manageHref: opts.manageHref,
  };
}

function getResendRow(): IntegrationHealthRow {
  const cfg = emailConfigStatus();
  return {
    key: "resend",
    name: "Resend",
    category: "Notifications",
    connected: cfg.hasApiKey,
    status: cfg.hasApiKey ? "healthy" : "not_configured",
    lastSyncAt: null,
    errorDetails: cfg.hasApiKey ? null : "RESEND_API_KEY is not set",
    manageHref: "/api/debug/resend",
  };
}

function getClerkRow(): IntegrationHealthRow {
  const configured = Boolean(process.env.CLERK_SECRET_KEY) && Boolean(process.env.CLERK_WEBHOOK_SECRET);
  return {
    key: "clerk",
    name: "Clerk",
    category: "Authentication",
    connected: configured,
    status: configured ? "healthy" : "error",
    lastSyncAt: null,
    errorDetails: configured ? null : "CLERK_SECRET_KEY or CLERK_WEBHOOK_SECRET is not set",
    manageHref: null,
  };
}

function getSupabaseStorageRow(): IntegrationHealthRow {
  return {
    key: "supabase-storage",
    name: "Supabase Storage",
    category: "Storage",
    connected: false,
    status: "not_configured",
    lastSyncAt: null,
    errorDetails: "File storage is not configured — uploads are stored as binary data in PostgreSQL.",
    manageHref: null,
  };
}

function getDwollaRow(): IntegrationHealthRow {
  return {
    key: "dwolla",
    name: "Dwolla",
    category: "Payments",
    connected: false,
    status: "unavailable",
    lastSyncAt: null,
    errorDetails: "Not yet available.",
    manageHref: null,
  };
}

export async function getIntegrationHealthSnapshot(organizationId: string): Promise<IntegrationHealthRow[]> {
  const [zoho, setu, plaid] = await Promise.all([
    getZohoRows(organizationId),
    getBankProviderRow(organizationId, {
      key: "setu",
      name: "Setu (Account Aggregator)",
      provider: "SETU_AA",
      manageHref: "/banking/consent",
    }),
    getBankProviderRow(organizationId, {
      key: "plaid",
      name: "Plaid",
      provider: "MANUAL",
      requirePlaid: true,
      manageHref: "/banking/connections",
    }),
  ]);

  return [...zoho, setu, plaid, getResendRow(), getClerkRow(), getSupabaseStorageRow(), getDwollaRow()];
}
