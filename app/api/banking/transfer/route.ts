import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { transferSchema } from "@/lib/banking/validations";
import { createTransferJournalEntry, updateAccountBalance } from "@/lib/banking/ledger-integration";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 422 });
    }

    const { fromAccountId, toAccountId, amount, transferDate, notes, referenceNumber } = parsed.data;

    if (fromAccountId === toAccountId) {
      return NextResponse.json({ error: "Cannot transfer to the same account" }, { status: 422 });
    }

    // Verify both accounts belong to this org
    const [fromAccount, toAccount] = await Promise.all([
      prisma.bankAccount.findFirst({ where: { id: fromAccountId, organizationId: orgId, isActive: true } }),
      prisma.bankAccount.findFirst({ where: { id: toAccountId, organizationId: orgId, isActive: true } }),
    ]);

    if (!fromAccount) return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    if (!toAccount) return NextResponse.json({ error: "Destination account not found" }, { status: 404 });

    // Check sufficient balance
    if (Number(fromAccount.availableBalance) < amount) {
      return NextResponse.json({ error: "Insufficient balance in source account" }, { status: 422 });
    }

    const txDate = new Date(transferDate as string);
    const ref = referenceNumber ?? `TRF-${Date.now()}`;
    const narration = `Internal Transfer: ${fromAccount.accountName} → ${toAccount.accountName}${notes ? ` - ${notes}` : ""}`;

    // Create debit in source and credit in destination atomically
    const [debitTxn, creditTxn] = await prisma.$transaction([
      prisma.bankTransaction.create({
        data: {
          organizationId: orgId,
          bankAccountId: fromAccountId,
          transactionDate: txDate,
          narration,
          referenceNumber: ref,
          debit: amount,
          source: "MANUAL",
          txnType: "NEFT",
          category: "Internal Transfer",
          status: "REVIEWED",
        },
      }),
      prisma.bankTransaction.create({
        data: {
          organizationId: orgId,
          bankAccountId: toAccountId,
          transactionDate: txDate,
          narration,
          referenceNumber: ref,
          credit: amount,
          source: "MANUAL",
          txnType: "NEFT",
          category: "Internal Transfer",
          status: "REVIEWED",
        },
      }),
    ]);

    // Create double-entry journal
    await createTransferJournalEntry(orgId, fromAccountId, toAccountId, amount, narration, txDate);

    // Update balances
    await Promise.all([
      updateAccountBalance(fromAccountId, orgId),
      updateAccountBalance(toAccountId, orgId),
    ]);

    await createAuditLog({
      organizationId: orgId,
      userId,
      action: "CREATE",
      entity: "BankTransaction",
      description: `Internal transfer of ₹${amount.toLocaleString("en-IN")} from ${fromAccount.accountName} to ${toAccount.accountName}`,
    });

    return NextResponse.json({ debitTxnId: debitTxn.id, creditTxnId: creditTxn.id }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "transfer" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
