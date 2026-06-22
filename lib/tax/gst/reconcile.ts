// ============================================================
// lib/tax/gst/reconcile.ts
//
// Reconcile purchase invoices in the books (inward GstInvoice) against
// the auto-drafted GSTR-2B. Produces a GstReconciliation summary +
// per-invoice GstMismatch rows categorized as:
//   MATCHED          — present both sides, values agree
//   PARTIAL/MISMATCH — present both sides, values differ
//   MISSING_IN_2B    — in books, not in 2B (ITC may be deferred)
//   MISSING_IN_BOOKS — in 2B, not in books (unrecorded purchase)
// ============================================================

import { prisma } from "@/lib/prisma";
import type { GstMatchOutcome, GstMismatchKind, Prisma } from "@prisma/client";
import { absDiff, approxEqual, round2, toNumber } from "../core/money";

function normKey(gstin: string | null | undefined, invNo: string): string {
  return `${(gstin ?? "NA").toUpperCase().trim()}::${invNo.replace(/\s+/g, "").toUpperCase()}`;
}

export interface ReconcileResult {
  reconciliationId: string;
  matchedCount: number;
  partialCount: number;
  mismatchCount: number;
  missingIn2bCount: number;
  missingInBooksCount: number;
  itcInBooks: number;
  itcIn2b: number;
  itcDifference: number;
}

export async function reconcile2b(
  organizationId: string,
  gstin: string,
  period: string,
  runById?: string
): Promise<ReconcileResult> {
  const [books, recs] = await Promise.all([
    prisma.gstInvoice.findMany({
      where: { organizationId, period, direction: "INWARD", deletedAt: null },
    }),
    prisma.gstr2bRecord.findMany({ where: { organizationId, gstin, period } }),
  ]);

  const booksByKey = new Map(books.map((b) => [normKey(b.counterpartyGstin, b.invoiceNumber), b]));
  const recsByKey = new Map(recs.map((r) => [normKey(r.supplierGstin, r.invoiceNumber), r]));

  const mismatches: Prisma.GstMismatchCreateManyReconciliationInput[] = [];
  let matchedCount = 0;
  let partialCount = 0;
  let mismatchCount = 0;
  let missingIn2bCount = 0;
  let missingInBooksCount = 0;

  // Pass 1: every book invoice vs 2B
  for (const [key, b] of booksByKey) {
    const bookTax = toNumber(b.igst) + toNumber(b.cgst) + toNumber(b.sgst);
    const rec = recsByKey.get(key);
    if (!rec) {
      missingIn2bCount++;
      mismatches.push({
        organizationId,
        outcome: "MISSING_IN_2B",
        kind: "MISSING_INVOICE",
        supplierGstin: b.counterpartyGstin,
        invoiceNumber: b.invoiceNumber,
        bookInvoiceId: b.id,
        bookTaxable: round2(b.taxableValue),
        bookTax: round2(bookTax),
        difference: round2(bookTax),
      });
      continue;
    }
    const recTax = toNumber(rec.igst) + toNumber(rec.cgst) + toNumber(rec.sgst);
    const taxableOk = approxEqual(b.taxableValue, rec.taxableValue);
    const taxOk = approxEqual(bookTax, recTax);
    if (taxableOk && taxOk) {
      matchedCount++;
      mismatches.push({
        organizationId,
        outcome: "MATCHED",
        supplierGstin: b.counterpartyGstin,
        invoiceNumber: b.invoiceNumber,
        bookInvoiceId: b.id,
        record2bId: rec.id,
        bookTaxable: round2(b.taxableValue),
        bookTax: round2(bookTax),
        gstr2bTaxable: round2(rec.taxableValue),
        gstr2bTax: round2(recTax),
        difference: round2(0),
      });
    } else {
      const kind: GstMismatchKind = !taxOk ? "TAX_AMOUNT" : "TAXABLE_VALUE";
      const outcome: GstMatchOutcome = taxableOk || taxOk ? "PARTIAL" : "MISMATCH";
      if (outcome === "PARTIAL") partialCount++;
      else mismatchCount++;
      mismatches.push({
        organizationId,
        outcome,
        kind,
        supplierGstin: b.counterpartyGstin,
        invoiceNumber: b.invoiceNumber,
        bookInvoiceId: b.id,
        record2bId: rec.id,
        bookTaxable: round2(b.taxableValue),
        bookTax: round2(bookTax),
        gstr2bTaxable: round2(rec.taxableValue),
        gstr2bTax: round2(recTax),
        difference: absDiff(bookTax, recTax),
      });
    }
  }

  // Pass 2: 2B records with no matching book invoice
  for (const [key, rec] of recsByKey) {
    if (booksByKey.has(key)) continue;
    const recTax = toNumber(rec.igst) + toNumber(rec.cgst) + toNumber(rec.sgst);
    missingInBooksCount++;
    mismatches.push({
      organizationId,
      outcome: "MISSING_IN_BOOKS",
      kind: "EXTRA_INVOICE",
      supplierGstin: rec.supplierGstin,
      invoiceNumber: rec.invoiceNumber,
      record2bId: rec.id,
      gstr2bTaxable: round2(rec.taxableValue),
      gstr2bTax: round2(recTax),
      difference: round2(recTax),
    });
  }

  const itcInBooks = books.reduce((s, b) => s + toNumber(b.itcIgst) + toNumber(b.itcCgst) + toNumber(b.itcSgst) + toNumber(b.itcCess), 0);
  const itcIn2b = recs.reduce((s, r) => s + toNumber(r.igst) + toNumber(r.cgst) + toNumber(r.sgst) + toNumber(r.cess), 0);

  // Replace prior reconciliation for this period and persist.
  const recon = await prisma.$transaction(async (tx) => {
    await tx.gstReconciliation.deleteMany({ where: { organizationId, gstin, period } });
    return tx.gstReconciliation.create({
      data: {
        organizationId,
        gstin,
        period,
        status: "COMPLETED",
        matchedCount,
        partialCount,
        mismatchCount,
        missingIn2bCount,
        missingInBooksCount,
        itcInBooks: round2(itcInBooks),
        itcIn2b: round2(itcIn2b),
        itcDifference: absDiff(itcInBooks, itcIn2b),
        runById,
        summary: { matchedCount, partialCount, mismatchCount, missingIn2bCount, missingInBooksCount } as Prisma.InputJsonValue,
        mismatches: { createMany: { data: mismatches } },
      },
    });
  });

  return {
    reconciliationId: recon.id,
    matchedCount,
    partialCount,
    mismatchCount,
    missingIn2bCount,
    missingInBooksCount,
    itcInBooks: round2(itcInBooks).toNumber(),
    itcIn2b: round2(itcIn2b).toNumber(),
    itcDifference: absDiff(itcInBooks, itcIn2b).toNumber(),
  };
}
