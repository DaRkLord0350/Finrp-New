// ============================================================
// FinRP — Inngest Event Catalog
//
// Single source of truth for every asynchronous workload's event
// name and payload shape. Event-data types are imported (type-only,
// erased at runtime — no import cycle) from the domain modules that
// own them so there is exactly one definition per payload.
//
// Naming convention: "<domain>/<noun>.<verb>" (e.g. csv/import.requested).
// ============================================================

import type { ImportJobData, SyncJobData, WebhookJobData } from "@/lib/jobs/queues";
import type { BankSyncQueueJobData } from "@/lib/banking/queue";
import type { BankImportJobData } from "@/lib/banking/types";
import type { TaxJobData } from "@/lib/tax/queue";
import type { AnalyticsJobData } from "@/lib/workers/analytics-queue";
import type { BulkAccountUpdateJobData } from "@/lib/accounting/workers/bulk-account-update.worker";

// ---------------------------------------------------------------------------
// Email — self-contained so the notification layer can depend on inngest
// without inngest depending back on it.
// ---------------------------------------------------------------------------
export interface EmailSendEventData {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: { filename: string; content: string }[];
  /** Optional tenant tag for the BackgroundJob ledger. */
  organizationId?: string;
  /** Short label for observability, e.g. "invoice", "team-invite". */
  kind?: string;
}

// ---------------------------------------------------------------------------
// Invoice PDF generation
// ---------------------------------------------------------------------------
export interface InvoicePdfGenerateEventData {
  invoiceId: string;
  organizationId: string;
  /** When true the generated PDF is emailed to the customer afterwards. */
  deliver?: boolean;
  /** Recipient + delivery options (used when deliver === true). */
  recipientEmail?: string;
  cc?: string[];
  bcc?: string[];
  subject?: string;
  message?: string;
  shareUrl?: string;
  requestedById?: string;
  actorName?: string;
}

// ---------------------------------------------------------------------------
// Event name constants — import these instead of typing string literals.
// ---------------------------------------------------------------------------
export const EVENTS = {
  CSV_IMPORT_REQUESTED: "csv/import.requested",
  CSV_IMPORT_COMPLETED: "csv/import.completed",
  INTEGRATION_SYNC_REQUESTED: "integration/sync.requested",
  WEBHOOK_ZOHO_RECEIVED: "webhook/zoho.received",
  BANK_SYNC_REQUESTED: "bank/sync.requested",
  BANK_IMPORT_REQUESTED: "bank/import.requested",
  TAX_JOB_REQUESTED: "tax/job.requested",
  ACCOUNTING_BULK_UPDATE_REQUESTED: "accounting/bulk-update.requested",
  ANALYTICS_SNAPSHOT_REQUESTED: "analytics/snapshot.requested",
  INVOICE_PDF_GENERATE: "invoice/pdf.generate",
  EMAIL_SEND: "email/send",
} as const;

// ---------------------------------------------------------------------------
// Canonical event → payload map. Reference catalog used by producers (which
// send `data` typed to the matching interface) and consumers (which cast
// `event.data`). One definition per payload, keyed by the EVENTS constants.
// ---------------------------------------------------------------------------
export type Events = {
  [EVENTS.CSV_IMPORT_REQUESTED]: { data: ImportJobData };
  [EVENTS.CSV_IMPORT_COMPLETED]: {
    data: {
      importJobId: string;
      organizationId: string;
      status: "COMPLETED" | "PARTIAL" | "FAILED";
      successRows?: number;
      failedRows?: number;
    };
  };
  [EVENTS.INTEGRATION_SYNC_REQUESTED]: { data: SyncJobData };
  [EVENTS.WEBHOOK_ZOHO_RECEIVED]: { data: WebhookJobData };
  [EVENTS.BANK_SYNC_REQUESTED]: { data: BankSyncQueueJobData };
  [EVENTS.BANK_IMPORT_REQUESTED]: { data: BankImportJobData };
  [EVENTS.TAX_JOB_REQUESTED]: { data: TaxJobData };
  [EVENTS.ACCOUNTING_BULK_UPDATE_REQUESTED]: { data: BulkAccountUpdateJobData };
  [EVENTS.ANALYTICS_SNAPSHOT_REQUESTED]: { data: AnalyticsJobData };
  [EVENTS.INVOICE_PDF_GENERATE]: { data: InvoicePdfGenerateEventData };
  [EVENTS.EMAIL_SEND]: { data: EmailSendEventData };
};
