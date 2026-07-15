// ============================================================
// lib/integrations/health.ts
//
// Normalizes connection health across every audited integration
// (excludes Razorpay — billing has its own dedicated surface) into one
// shape for the /integrations/health page. Each provider is sourced
// from whatever model actually backs it today:
//   • Zoho CRM/Books/Inventory → Integration rows (OAuth connectors)
//   • Resend                   → emailConfigStatus() (API-key based, no OAuth)
//   • Clerk                    → env-var presence (platform auth layer)
//   • Supabase Storage         → not wired; static row, no manage action
//
// Banking (TBX) has no row yet — it comes back once BankConnection.provider
// gains a TBX value and the Balance API integration (Phase 2A) lands. Setu
// and Plaid were removed along with their rows here.
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

export async function getIntegrationHealthSnapshot(organizationId: string): Promise<IntegrationHealthRow[]> {
  const zoho = await getZohoRows(organizationId);
  return [...zoho, getResendRow(), getClerkRow(), getSupabaseStorageRow()];
}
