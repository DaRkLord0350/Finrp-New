// ============================================================
// FinRP — Reconciliation Suggestions for one bank transaction
// GET /api/banking/transactions/[id]/suggestions
// Returns ranked match candidates against open invoices,
// payments, and expenses (Zoho-style "best match" panel), plus
// an account-categorization suggestion for bank charges.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";

const WINDOW_DAYS = 30;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;

interface Suggestion {
  entityType: "INVOICE" | "PAYMENT" | "EXPENSE";
  entityId: string;
  entityRef: string;
  entityDate: string;
  amount: number;
  confidence: number;
  reason: string;
}

function confidence(narration: string, ref: string, bankAmount: number, entityAmount: number): number {
  let score = 0;
  const diff = Math.abs(bankAmount - entityAmount);
  const pct = bankAmount > 0 ? diff / bankAmount : 1;
  score += Math.max(0, 0.5 - pct * 5);
  if (ref && narration) {
    const refNorm = ref.replace(/[-/\s]/g, "").toLowerCase();
    const narNorm = narration.replace(/[-/\s]/g, "").toLowerCase();
    if (refNorm.length > 3 && narNorm.includes(refNorm)) score += 0.3;
    else if (refNorm.length > 3 && narNorm.includes(refNorm.slice(0, 6))) score += 0.15;
  }
  if (diff < 0.01) score += 0.2;
  return Math.min(1, Math.round(score * 100) / 100);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { id } = await params;

  try {
    const txn = await prisma.bankTransaction.findFirst({
      where: { id, organizationId: orgId },
      select: {
        id: true, narration: true, credit: true, debit: true,
        transactionDate: true, txnType: true, category: true,
      },
    });
    if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const amount = Number(txn.credit ?? txn.debit ?? 0);
    const isCredit = Number(txn.credit ?? 0) > 0;
    const dateFrom = new Date(txn.transactionDate.getTime() - WINDOW_MS);
    const dateTo = new Date(txn.transactionDate.getTime() + WINDOW_MS);
    const suggestions: Suggestion[] = [];

    if (isCredit) {
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId: orgId,
          status: { in: ["SENT", "PARTIAL"] },
          dueDate: { gte: dateFrom, lte: dateTo },
        },
        select: { id: true, invoiceNumber: true, total: true, dueDate: true },
        take: 50,
      });
      for (const inv of invoices) {
        const c = confidence(txn.narration, inv.invoiceNumber, amount, Number(inv.total));
        if (c < 0.3) continue;
        suggestions.push({
          entityType: "INVOICE",
          entityId: inv.id,
          entityRef: inv.invoiceNumber,
          entityDate: inv.dueDate.toISOString(),
          amount: Number(inv.total),
          confidence: c,
          reason: c >= 0.85 ? "Amount and reference match" : "Amount within tolerance",
        });
      }
    } else {
      const [payments, expenses] = await Promise.all([
        prisma.payment.findMany({
          where: { organizationId: orgId, deletedAt: null, paidAt: { gte: dateFrom, lte: dateTo } },
          select: { id: true, reference: true, amount: true, paidAt: true },
          take: 50,
        }),
        prisma.expense.findMany({
          where: { organizationId: orgId, deletedAt: null, expenseDate: { gte: dateFrom, lte: dateTo } },
          select: { id: true, description: true, vendorName: true, amount: true, taxAmount: true, expenseDate: true },
          take: 50,
        }),
      ]);

      for (const pmt of payments) {
        const c = confidence(txn.narration, pmt.reference ?? "", amount, Number(pmt.amount));
        if (c < 0.3) continue;
        suggestions.push({
          entityType: "PAYMENT",
          entityId: pmt.id,
          entityRef: pmt.reference ?? "(payment)",
          entityDate: pmt.paidAt.toISOString(),
          amount: Number(pmt.amount),
          confidence: c,
          reason: c >= 0.85 ? "Amount and reference match" : "Amount within tolerance",
        });
      }
      for (const exp of expenses) {
        const expAmount = Number(exp.amount) + Number(exp.taxAmount);
        const ref = exp.vendorName ?? exp.description;
        const c = confidence(txn.narration, ref, amount, expAmount);
        if (c < 0.3) continue;
        suggestions.push({
          entityType: "EXPENSE",
          entityId: exp.id,
          entityRef: ref,
          entityDate: exp.expenseDate.toISOString(),
          amount: expAmount,
          confidence: c,
          reason: c >= 0.85 ? "Vendor and amount match" : "Amount within tolerance",
        });
      }
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);

    // Bank charges / interest → suggest a ledger account categorization
    let accountSuggestion: { category: string; reason: string } | null = null;
    if (!txn.category) {
      const narration = txn.narration.toLowerCase();
      if (txn.txnType === "BANK_CHARGE" || /charge|chrg|fee|comm(ission)?|gst on/i.test(narration)) {
        accountSuggestion = { category: "Bank Charges", reason: "Narration indicates a bank fee/charge" };
      } else if (txn.txnType === "INTEREST" || /\bint(erest)?\b.*(credit|paid|earned)|sb int/i.test(narration)) {
        accountSuggestion = { category: "Interest Income", reason: "Narration indicates bank interest" };
      }
    }

    return NextResponse.json({
      transactionId: txn.id,
      suggestions: suggestions.slice(0, 10),
      accountSuggestion,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "match-suggestions" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
