// ============================================================
// FinRP Banking OS — Bank Statement Import BullMQ Worker
// Processes uploaded CSV/Excel/PDF files, deduplicates,
// stores transactions, runs categorization + risk checks.
// ============================================================

import { Worker, Queue, type Job } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { parseCSV, parseExcel, parsePDF, detectColumnMapping } from "../integrations/statement-parser";
import { filterDuplicates, computeTxnSignature } from "../duplicate-detector";
import { bulkCategorize } from "../categorization-engine";
import { analyzeRecentTransactions } from "../risk-detector";
import { updateAccountBalance } from "../ledger-integration";
import type { BankImportJobData, ParsedBankTransaction } from "../types";

export const BANK_IMPORT_QUEUE = "finrp-bank-import";

let importQueue: Queue<BankImportJobData> | null = null;

export function getBankImportQueue(): Queue<BankImportJobData> {
  if (!importQueue) {
    importQueue = new Queue<BankImportJobData>(BANK_IMPORT_QUEUE, {
      connection: getRedisConnection("queue"),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return importQueue;
}

export async function enqueueBankImport(data: BankImportJobData): Promise<string> {
  const q = getBankImportQueue();
  const job = await q.add("process-bank-import", data, {
    jobId: `bank-import-${data.importId}`,
  });
  return job.id ?? `bank-import-${data.importId}`;
}

// ---------------------------------------------------------------------------
// Create worker
// ---------------------------------------------------------------------------
export function createBankImportWorker() {
  const worker = new Worker<BankImportJobData>(
    BANK_IMPORT_QUEUE,
    async (job: Job<BankImportJobData>) => {
      return processBankImport(job);
    },
    {
      connection: getRedisConnection("worker"),
      concurrency: 2,
      limiter: { max: 5, duration: 60_000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[BankImportWorker] ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[BankImportWorker] ${job?.id} failed: ${err.message}`);
  });

  return worker;
}

// ---------------------------------------------------------------------------
// Core import processor
// ---------------------------------------------------------------------------
async function processBankImport(job: Job<BankImportJobData>): Promise<void> {
  const { importId, organizationId, bankAccountId, fileUrl, fileType, columnMapping } = job.data;

  await prisma.bankStatementImport.update({
    where: { id: importId },
    data: { status: "PROCESSING" },
  });

  await job.updateProgress(5);

  let parseResult;

  try {
    const fileBuffer = await downloadFile(fileUrl);
    await job.updateProgress(20);

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

    await job.updateProgress(40);

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

    const targetAccountId = bankAccountId ?? await resolveAccountFromStatement(
      organizationId,
      parseResult.detectedBank
    );

    if (!targetAccountId) {
      throw new Error("No bank account specified or detectable from statement");
    }

    // Deduplicate
    const { unique, duplicateCount } = await filterDuplicates(
      targetAccountId,
      parseResult.transactions
    );

    await job.updateProgress(60);

    // Batch insert
    const source = fileType === "CSV" ? "CSV_UPLOAD" as const
      : fileType === "EXCEL" ? "EXCEL_UPLOAD" as const
      : "PDF_UPLOAD" as const;

    const batches = chunk(unique, 100);
    let successRows = 0;
    let errorRows = parseResult.errorRows;

    for (const batch of batches) {
      const createData = batch.map(txn => {
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
        await prisma.bankTransaction.createMany({
          data: createData,
          skipDuplicates: true,
        });
        successRows += batch.length;
      } catch (batchErr) {
        console.error("[BankImportWorker] Batch insert error:", (batchErr as Error).message);
        errorRows += batch.length;
      }
    }

    await job.updateProgress(80);

    // Post-import pipeline
    const syncStart = new Date(Date.now() - 60_000);
    await bulkCategorize(organizationId, undefined);
    await analyzeRecentTransactions(organizationId, targetAccountId, syncStart);
    await updateAccountBalance(targetAccountId, organizationId);

    await job.updateProgress(95);

    const finalStatus = errorRows > 0 && successRows === 0
      ? "FAILED"
      : errorRows > 0
      ? "PARTIAL"
      : "COMPLETED";

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

    await job.updateProgress(100);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.bankStatementImport.update({
      where: { id: importId },
      data: {
        status: "FAILED",
        errors: [{ row: 0, message }] as never,
        processedAt: new Date(),
      },
    }).catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function downloadFile(fileUrl: string): Promise<Buffer> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
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
