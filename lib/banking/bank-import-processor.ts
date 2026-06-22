// ============================================================
// FinRP Banking OS — Bank Statement Import processor
// Pure processing logic (no queue runtime): parses uploaded
// CSV/Excel/PDF files, deduplicates, stores transactions, runs
// categorization + risk checks. Invoked by the bank-import Inngest
// function; `onProgress` reports 0..100 for the BackgroundJob ledger.
// ============================================================

import { prisma } from "@/lib/prisma";
import { parseCSV, parseExcel, parsePDF } from "./integrations/statement-parser";
import { filterDuplicates, computeTxnSignature } from "./duplicate-detector";
import { bulkCategorize } from "./categorization-engine";
import { analyzeRecentTransactions } from "./risk-detector";
import { updateAccountBalance } from "./ledger-integration";
import type { BankImportJobData } from "./types";

type ProgressFn = (progress: number) => void | Promise<void>;

export async function processBankImport(
  data: BankImportJobData,
  onProgress: ProgressFn = () => {}
): Promise<void> {
  const { importId, organizationId, bankAccountId, fileUrl, fileType, columnMapping } = data;

  await prisma.bankStatementImport.update({
    where: { id: importId },
    data: { status: "PROCESSING" },
  });

  await onProgress(5);

  let parseResult;

  try {
    const fileBuffer = await downloadFile(fileUrl);
    await onProgress(20);

    switch (fileType) {
      case "CSV":
        parseResult = parseCSV(fileBuffer.toString("utf-8"), columnMapping);
        break;
      case "EXCEL":
        parseResult = parseExcel(fileBuffer, columnMapping);
        break;
      case "PDF":
        parseResult = await parsePDF(fileBuffer, columnMapping);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    await onProgress(40);

    if (parseResult.transactions.length === 0) {
      await prisma.bankStatementImport.update({
        where: { id: importId },
        data: {
          status: "FAILED",
          totalRows: parseResult.totalRows,
          errorRows: parseResult.errorRows,
          errors: parseResult.errors as never,
          processedAt: new Date(),
          detectedBank: parseResult.detectedBank,
        },
      });
      return;
    }

    const targetAccountId =
      bankAccountId ?? (await resolveAccountFromStatement(organizationId, parseResult.detectedBank));

    if (!targetAccountId) {
      throw new Error("No bank account specified or detectable from statement");
    }

    // Deduplicate
    const { unique, duplicateCount } = await filterDuplicates(targetAccountId, parseResult.transactions);

    await onProgress(60);

    // Batch insert
    const source =
      fileType === "CSV"
        ? ("CSV_UPLOAD" as const)
        : fileType === "EXCEL"
          ? ("EXCEL_UPLOAD" as const)
          : ("PDF_UPLOAD" as const);

    const batches = chunk(unique, 100);
    let successRows = 0;
    let errorRows = parseResult.errorRows;

    for (const batch of batches) {
      const createData = batch.map((txn) => {
        const sig = computeTxnSignature(targetAccountId, txn);
        return {
          organizationId,
          bankAccountId: targetAccountId,
          transactionDate: txn.transactionDate,
          valueDate: txn.valueDate ?? null,
          narration: txn.narration,
          referenceNumber: txn.referenceNumber ?? null,
          chequeNumber: txn.chequeNumber ?? null,
          credit: txn.credit ?? null,
          debit: txn.debit ?? null,
          balance: txn.balance ?? null,
          source,
          importJobId: importId,
          status: "UNREVIEWED" as const,
          metadata: { sig },
        };
      });

      try {
        await prisma.bankTransaction.createMany({ data: createData, skipDuplicates: true });
        successRows += batch.length;
      } catch (batchErr) {
        console.error("[bank-import] Batch insert error:", (batchErr as Error).message);
        errorRows += batch.length;
      }
    }

    await onProgress(80);

    // Post-import pipeline
    const syncStart = new Date(Date.now() - 60_000);
    await bulkCategorize(organizationId, undefined);
    await analyzeRecentTransactions(organizationId, targetAccountId, syncStart);
    await updateAccountBalance(targetAccountId, organizationId);

    await onProgress(95);

    const finalStatus =
      errorRows > 0 && successRows === 0 ? "FAILED" : errorRows > 0 ? "PARTIAL" : "COMPLETED";

    await prisma.bankStatementImport.update({
      where: { id: importId },
      data: {
        status: finalStatus,
        bankAccountId: targetAccountId,
        totalRows: parseResult.totalRows,
        successRows,
        errorRows,
        duplicateRows: duplicateCount,
        errors: parseResult.errors.length > 0 ? (parseResult.errors as never) : undefined,
        detectedBank: parseResult.detectedBank ?? null,
        processedAt: new Date(),
      },
    });

    await onProgress(100);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.bankStatementImport
      .update({
        where: { id: importId },
        data: {
          status: "FAILED",
          errors: [{ row: 0, message }] as never,
          processedAt: new Date(),
        },
      })
      .catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// `fileUrl` is either an http(s) URL (object storage) or a local filesystem
// path for a statement uploaded through /api/banking/import (saved under tmp/,
// mirroring the main CSV import). Read whichever form was stored.
async function downloadFile(fileUrl: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(fileUrl)) {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const { readFile } = await import("fs/promises");
  return readFile(fileUrl);
}

async function resolveAccountFromStatement(
  organizationId: string,
  detectedBank?: string
): Promise<string | null> {
  if (!detectedBank) {
    const primary = await prisma.bankAccount.findFirst({
      where: { organizationId, isPrimary: true, isActive: true },
      select: { id: true },
    });
    return primary?.id ?? null;
  }

  const account = await prisma.bankAccount.findFirst({
    where: {
      organizationId,
      isActive: true,
      bankCode: { contains: detectedBank, mode: "insensitive" },
    },
    select: { id: true },
  });
  return account?.id ?? null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
