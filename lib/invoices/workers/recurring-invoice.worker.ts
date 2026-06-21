// ============================================================
// FinRP — Recurring Invoice worker (BullMQ)
//
// A repeatable hourly scan finds every active RecurringInvoice whose
// nextRunDate has arrived, generates a fresh invoice from its stored
// templateData, advances nextRunDate by the frequency, and deactivates the
// schedule once it passes endDate. Generation is idempotent per run date.
// ============================================================

import { Worker, Queue } from "bullmq";
import { addDays, addMonths, addYears, startOfDay, endOfDay } from "date-fns";
import { Prisma } from "@prisma/client";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { generateNextInvoiceNumber } from "@/lib/generators/invoice-number";
import { computeInvoiceTotals, type TotalsLineInput } from "@/lib/invoices/totals";
import { dueDateFromTerms } from "@/lib/invoices/payment-terms";
import { logInvoiceActivity } from "@/lib/invoices/activity";

export const RECURRING_INVOICE_QUEUE = "finrp-recurring-invoices";

interface TemplateItem {
  description: string;
  sku?: string | null;
  hsnSac?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  taxPercent?: number;
  discount?: number;
}

interface TemplateData {
  customerId?: string;
  currency?: string;
  paymentTerms?: string | null;
  salesperson?: string | null;
  subject?: string | null;
  taxRate?: number;
  discountType?: "FIXED" | "PERCENT";
  discountValue?: number;
  discount?: number; // legacy flat discount
  shipping?: number;
  adjustment?: number;
  tdsTcsType?: "TDS" | "TCS" | null;
  tdsTcsRate?: number;
  tdsTcsSectionId?: string | null;
  notes?: string | null;
  terms?: string | null;
  items?: TemplateItem[];
  dueOffsetDays?: number;
}

function advance(from: Date, frequency: string, customDays?: number | null): Date {
  switch (frequency) {
    case "WEEKLY": return addDays(from, 7);
    case "MONTHLY": return addMonths(from, 1);
    case "QUARTERLY": return addMonths(from, 3);
    case "YEARLY": return addYears(from, 1);
    case "CUSTOM": return addDays(from, customDays && customDays > 0 ? customDays : 30);
    default: return addMonths(from, 1);
  }
}

type Schedule = Prisma.RecurringInvoiceGetPayload<Record<string, never>>;

/**
 * Generate one invoice for a schedule's current run date (idempotent), then
 * advance the schedule. Returns the new invoice id, or null if nothing was due.
 */
export async function generateInvoiceFromSchedule(schedule: Schedule): Promise<string | null> {
  const runDate = schedule.nextRunDate;
  const organizationId = schedule.organizationId;

  // Past the configured end → stop the schedule.
  if (schedule.endDate && runDate > schedule.endDate) {
    await prisma.recurringInvoice.update({ where: { id: schedule.id }, data: { isActive: false } });
    return null;
  }

  const next = advance(runDate, schedule.frequency, schedule.customIntervalDays);
  const stillActive = !schedule.endDate || next <= schedule.endDate;

  // Idempotency: skip if this schedule already produced an invoice on the run day.
  const already = await prisma.invoice.findFirst({
    where: {
      organizationId,
      recurringInvoiceId: schedule.id,
      issueDate: { gte: startOfDay(runDate), lte: endOfDay(runDate) },
    },
    select: { id: true },
  });
  if (already) {
    await prisma.recurringInvoice.update({
      where: { id: schedule.id },
      data: { nextRunDate: next, lastRunDate: runDate, isActive: stillActive },
    });
    return null;
  }

  const tmpl = (schedule.templateData ?? {}) as TemplateData;
  const customerId = tmpl.customerId ?? schedule.customerId;

  const lines: TotalsLineInput[] = (tmpl.items ?? []).map((i) => ({
    quantity: Number(i.quantity),
    unitPrice: Number(i.unitPrice),
    discount: Number(i.discount ?? 0),
    taxPercent: Number(i.taxPercent ?? 0),
  }));

  const totals = computeInvoiceTotals({
    items: lines,
    invoiceTaxRate: Number(tmpl.taxRate ?? 0),
    discountType: tmpl.discountType === "PERCENT" ? "PERCENT" : "FIXED",
    discountValue: Number(tmpl.discountValue ?? tmpl.discount ?? 0),
    shipping: Number(tmpl.shipping ?? 0),
    adjustment: Number(tmpl.adjustment ?? 0),
    tdsTcsType: tmpl.tdsTcsType ?? null,
    tdsTcsRate: Number(tmpl.tdsTcsRate ?? 0),
  });

  const dueDate =
    dueDateFromTerms(runDate, tmpl.paymentTerms) ??
    addDays(runDate, tmpl.dueOffsetDays && tmpl.dueOffsetDays > 0 ? tmpl.dueOffsetDays : 30);

  const invoiceNumber = await generateNextInvoiceNumber(organizationId);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      customerId,
      organizationId,
      status: "DRAFT",
      issueDate: runDate,
      dueDate,
      recurringInvoiceId: schedule.id,
      currency: tmpl.currency || undefined,
      paymentTerms: tmpl.paymentTerms ?? null,
      salesperson: tmpl.salesperson ?? null,
      subject: tmpl.subject ?? null,
      subtotal: totals.subtotal,
      discountType: tmpl.discountType === "PERCENT" ? "PERCENT" : "FIXED",
      discountValue: Number(tmpl.discountValue ?? tmpl.discount ?? 0),
      discount: totals.invoiceDiscount,
      shipping: totals.shipping,
      adjustment: totals.adjustment,
      roundOff: totals.roundOff,
      taxRate: totals.effectiveTaxRate,
      taxAmount: totals.taxAmount,
      tdsTcsType: totals.tdsTcsType,
      tdsTcsSectionId: tmpl.tdsTcsSectionId ?? null,
      tdsTcsRate: totals.tdsTcsRate,
      tdsTcsAmount: totals.tdsTcsAmount,
      total: totals.grandTotal,
      balanceDue: totals.grandTotal,
      notes: tmpl.notes ?? null,
      terms: tmpl.terms ?? null,
      items: {
        create: (tmpl.items ?? []).map((item) => {
          const amount = Number(item.quantity) * Number(item.unitPrice);
          const lineDiscount = Number(item.discount ?? 0);
          return {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: item.unit ?? null,
            discount: lineDiscount,
            amount,
            sku: item.sku ?? null,
            hsnSac: item.hsnSac ?? null,
            taxPercent: item.taxPercent ?? 0,
            taxAmount: (amount - lineDiscount) * ((item.taxPercent ?? 0) / 100),
          };
        }),
      },
    },
    select: { id: true, invoiceNumber: true },
  });

  await prisma.recurringInvoice.update({
    where: { id: schedule.id },
    data: { nextRunDate: next, lastRunDate: runDate, isActive: stillActive },
  });

  await logInvoiceActivity({
    invoiceId: invoice.id,
    organizationId,
    type: "RECURRING",
    message: `Auto-generated from recurring schedule (${schedule.frequency.toLowerCase()})`,
    metadata: { recurringInvoiceId: schedule.id, total: totals.grandTotal },
  });

  return invoice.id;
}

/** Core scan — exported so it can also be invoked inline (tests / manual run). */
export async function processDueRecurringInvoices(now = new Date()): Promise<{ generated: number; scanned: number }> {
  const due = await prisma.recurringInvoice.findMany({
    where: { isActive: true, nextRunDate: { lte: now } },
    take: 500,
  });

  let generated = 0;
  for (const schedule of due) {
    try {
      const id = await generateInvoiceFromSchedule(schedule);
      if (id) generated++;
    } catch (err) {
      console.error(`[RecurringInvoice] schedule ${schedule.id} failed:`, err);
    }
  }
  return { generated, scanned: due.length };
}

// ── Queue + repeatable scan ────────────────────────────────
let queue: Queue | null = null;
export function getRecurringInvoiceQueue(): Queue {
  if (!queue) {
    queue = new Queue(RECURRING_INVOICE_QUEUE, {
      connection: getRedisConnection("queue"),
      defaultJobOptions: { attempts: 2, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } },
    });
  }
  return queue;
}

/** Register the hourly repeatable scan (idempotent — fixed jobId). */
export async function scheduleRecurringInvoiceScan(): Promise<void> {
  const q = getRecurringInvoiceQueue();
  await q.add(
    "scan",
    {},
    { jobId: "recurring-invoice-scan", repeat: { every: 60 * 60 * 1000 } } // hourly
  );
}

export function createRecurringInvoiceWorker(): Worker {
  return new Worker(
    RECURRING_INVOICE_QUEUE,
    async () => {
      const result = await processDueRecurringInvoices();
      console.log(`[RecurringInvoice] scanned=${result.scanned} generated=${result.generated}`);
      return result;
    },
    { connection: getRedisConnection("worker"), concurrency: 1 }
  );
}
