// ============================================================
// FinRP — Workers Entry Point
// Long-running Node.js process that starts all BullMQ workers
// and the stuck-job recovery checker.
//
// Run:  npx tsx workers/index.ts
//
// In production: deploy as a separate service/container.
// ============================================================
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local (dev) or .env (fallback) IMMEDIATELY
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Dynamic imports to ensure env is loaded first
async function startWorkers() {
  const { createImportWorker } = await import("@/lib/jobs/workers/import.worker");
  const { createSyncWorker } = await import("@/lib/jobs/workers/sync.worker");
  const { createWebhookWorker } = await import("@/lib/jobs/workers/webhook.worker");
  const { startStuckJobChecker } = await import("@/lib/jobs/workers/stuck-job-checker");
  const { createBankSyncWorker } = await import("@/lib/banking/workers/bank-sync.worker");
  const { createBankImportWorker } = await import("@/lib/banking/workers/bank-import.worker");
  const { scheduleBankAutoSyncScan } = await import("@/lib/banking/queue");
  const { createBulkAccountUpdateWorker } = await import("@/lib/accounting/workers/bulk-account-update.worker");
  const { createRecurringInvoiceWorker, scheduleRecurringInvoiceScan } = await import("@/lib/invoices/workers/recurring-invoice.worker");

  console.log("═══════════════════════════════════════════════════");
  console.log("  FinRP Workers starting");
  console.log(`  REDIS_URL = ${process.env.REDIS_URL?.replace(/:[^:@]+@/, ":***@") ?? "(unset)"}`);
  console.log(`  DATABASE_URL = ${process.env.DATABASE_URL ? "(configured)" : "(unset)"}`);
  console.log(`  NODE_ENV  = ${process.env.NODE_ENV ?? "(unset)"}`);
  console.log("═══════════════════════════════════════════════════");

  // Validate required environment variables
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not configured");
    process.exit(1);
  }

  // Warn about optional Redis if needed
  if (!process.env.REDIS_URL) {
    console.warn("⚠️  REDIS_URL not configured - using localhost (dev mode)");
  }

  const workers = [
    createImportWorker(),
    createSyncWorker(),
    createWebhookWorker(),
    createBankSyncWorker(),
    createBankImportWorker(),
    createBulkAccountUpdateWorker(),
    createRecurringInvoiceWorker(),
  ];

  console.log(`[Workers] ${workers.length} workers started`);
  console.log("  • import       worker (concurrency=3)");
  console.log("  • sync         worker (concurrency=5)");
  console.log("  • webhook      worker (concurrency=10)");
  console.log("  • bank-sync    worker (concurrency=3)");
  console.log("  • bank-import  worker (concurrency=2)");
  console.log("  • bulk-account worker (concurrency=1)");
  console.log("  • recurring-invoice worker (concurrency=1)");

  // Repeatable scan that fans out scheduled bank refreshes (idempotent)
  await scheduleBankAutoSyncScan().catch((err) => {
    console.error("[Workers] Failed to schedule bank auto-sync scan:", err);
  });

  // Repeatable hourly scan that generates due recurring invoices (idempotent)
  await scheduleRecurringInvoiceScan().catch((err) => {
    console.error("[Workers] Failed to schedule recurring-invoice scan:", err);
  });

  // Stuck-job checker — runs every 60 s in the same process
  const checkerTimer = startStuckJobChecker(60_000);

  console.log("[Workers] Stuck-job checker started (60s interval)");

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------

  let isShuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n[Workers] ${signal} received — shutting down gracefully…`);

    clearInterval(checkerTimer);

    await Promise.allSettled(workers.map((w) => w.close()));

    console.log("[Workers] All workers stopped. Exiting.");
    process.exit(0);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    console.error("[Workers] Uncaught exception:", err.message, err.stack);
    void gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[Workers] Unhandled rejection:", reason);
  });
}

// Start the workers
startWorkers().catch((err) => {
  console.error("[Workers] Failed to start:", err);
  process.exit(1);
});
