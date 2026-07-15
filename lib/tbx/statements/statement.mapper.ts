// ============================================================
// FinRP — TBX Statement mapper
// Converts parsed statement lines into BankTransaction rows ready
// for createMany({ skipDuplicates: true }) — dedup key is the
// existing @@unique([bankAccountId, externalTxnId]) constraint.
// ============================================================

import { Prisma } from "@prisma/client";
import type { ParsedStatementLine } from "./statement.parser";

export function toBankTransactionRows(
  organizationId: string,
  bankAccountId: string,
  lines: ParsedStatementLine[]
): Prisma.BankTransactionCreateManyInput[] {
  return lines.map((line) => ({
    organizationId,
    bankAccountId,
    externalTxnId: line.externalTxnId,
    transactionDate: line.transactionDate,
    valueDate: line.valueDate ?? null,
    narration: line.narration,
    referenceNumber: line.referenceNumber ?? line.externalTxnId,
    utr: line.utr ?? null,
    credit: line.credit !== undefined ? new Prisma.Decimal(line.credit) : null,
    debit: line.debit !== undefined ? new Prisma.Decimal(line.debit) : null,
    balance: line.balanceAfter !== undefined ? new Prisma.Decimal(line.balanceAfter) : null,
    txnType: line.txnType,
    source: "TBX_API",
    status: "UNREVIEWED",
  }));
}
