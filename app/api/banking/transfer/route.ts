import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import { transferSchema } from "@/lib/banking/validations";
import { createTransferJournalEntry, updateAccountBalance } from "@/lib/banking/ledger-integration";
import { createAuditLog } from "@/lib/audit";

class InsufficientFundsError extends Error {}
class AccountNotFoundError extends Error {
  constructor(readonly which: "source" | "destination") {
    super(`${which} account not found`);
  }
}

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

    const { fromAccountId, toAccountId, transferDate, notes, referenceNumber } = parsed.data;
    const amount = new Prisma.Decimal(parsed.data.amount);

    if (fromAccountId === toAccountId) {
      return NextResponse.json({ error: "Cannot transfer to the same account" }, { status: 422 });
    }

    const txDate = new Date(transferDate as string);
    const ref = referenceNumber ?? `TRF-${Date.now()}`;

    // Everything that must stay consistent runs inside ONE transaction:
    // row-lock → re-read balances → fund check → both legs → journal → balances.
    // The FOR UPDATE lock (acquired in deterministic id order to avoid
    // deadlocks) serialises concurrent transfers touching these accounts,
    // which is what prevents double-spending under concurrency.
    const result = await prisma.$transaction(async (tx) => {
      const lockIds = [fromAccountId, toAccountId].sort();
      await tx.$queryRaw`SELECT id FROM bank_accounts WHERE id IN (${Prisma.join(lockIds)}) AND "organizationId" = ${orgId} FOR UPDATE`;

      // Re-read INSIDE the lock so the balance check sees committed state.
      const [fromAccount, toAccount] = await Promise.all([
        tx.bankAccount.findFirst({ where: { id: fromAccountId, organizationId: orgId, isActive: true } }),
        tx.bankAccount.findFirst({ where: { id: toAccountId, organizationId: orgId, isActive: true } }),
      ]);
      if (!fromAccount) throw new AccountNotFoundError("source");
      if (!toAccount) throw new AccountNotFoundError("destination");

      // Validate sufficient funds immediately before committing (Decimal).
      if (new Prisma.Decimal(fromAccount.availableBalance).lessThan(amount)) {
        throw new InsufficientFundsError();
      }

      const narration = `Internal Transfer: ${fromAccount.accountName} → ${toAccount.accountName}${notes ? ` - ${notes}` : ""}`;

      const debitTxn = await tx.bankTransaction.create({
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
      });
      const creditTxn = await tx.bankTransaction.create({
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
      });

      // Double-entry journal, atomic with the two legs and idempotent on the
      // debit-leg id. A failure here rolls back the whole transfer.
      await createTransferJournalEntry(orgId, fromAccountId, toAccountId, amount, narration, txDate, {
        client: tx,
        reference: `BANK-TRF-${debitTxn.id}`,
      });

      // Recompute balances from the now-committed legs, inside the same tx.
      await updateAccountBalance(fromAccountId, orgId, tx);
      await updateAccountBalance(toAccountId, orgId, tx);

      return {
        debitTxnId: debitTxn.id,
        creditTxnId: creditTxn.id,
        fromName: fromAccount.accountName,
        toName: toAccount.accountName,
      };
    });

    await createAuditLog({
      organizationId: orgId,
      userId,
      action: "CREATE",
      entity: "BankTransaction",
      description: `Internal transfer of ₹${Number(amount).toLocaleString("en-IN")} from ${result.fromName} to ${result.toName}`,
    });

    return NextResponse.json({ debitTxnId: result.debitTxnId, creditTxnId: result.creditTxnId }, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return NextResponse.json({ error: "Insufficient balance in source account" }, { status: 422 });
    }
    if (err instanceof AccountNotFoundError) {
      return NextResponse.json({ error: `${err.which === "source" ? "Source" : "Destination"} account not found` }, { status: 404 });
    }
    Sentry.captureException(err, { tags: { area: "banking", action: "transfer" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
