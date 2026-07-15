// ============================================================
// FinRP — Inngest function registry
// Every Inngest function the app exposes is collected here and served
// by app/api/inngest/route.ts. Add new functions to this array.
// ============================================================

import { csvImport } from "./functions/import";
import { integrationSync } from "./functions/sync";
import { webhookZoho } from "./functions/webhook";
import { taxJob } from "./functions/tax";
import { bulkAccountUpdate } from "./functions/accounting";
import { analyticsSnapshot } from "./functions/analytics";
import { emailSend } from "./functions/email";
import { invoicePdf } from "./functions/invoices";
import { tbxVerification } from "./functions/tbx";
import {
  tbxBalanceSync,
  tbxBalanceAutoSync,
  tbxStatementSync,
  tbxStatementAutoSync,
  tbxBeneficiarySync,
  tbxBeneficiaryVerificationPoll,
  tbxBeneficiaryRetryFailedSyncs,
  tbxPaymentSync,
  tbxPaymentAutoPoll,
} from "./functions/tbx-banking";
import {
  recurringInvoiceScan,
  integrationScheduledSync,
  complianceReminders,
  analyticsNightly,
  stuckJobChecker,
} from "./functions/scheduled";

export { inngest } from "./client";

export const functions = [
  // Event-driven
  csvImport,
  integrationSync,
  webhookZoho,
  taxJob,
  bulkAccountUpdate,
  analyticsSnapshot,
  emailSend,
  invoicePdf,
  tbxVerification,
  tbxBalanceSync,
  tbxStatementSync,
  tbxBeneficiarySync,
  tbxPaymentSync,
  // Scheduled (cron)
  recurringInvoiceScan,
  integrationScheduledSync,
  complianceReminders,
  analyticsNightly,
  stuckJobChecker,
  tbxBalanceAutoSync,
  tbxStatementAutoSync,
  tbxBeneficiaryVerificationPoll,
  tbxBeneficiaryRetryFailedSyncs,
  tbxPaymentAutoPoll,
];
