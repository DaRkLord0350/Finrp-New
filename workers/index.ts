// ============================================================
// FinRP — Workers Entry Point
// Long-running Node.js process that starts all BullMQ workers
// and the stuck-job recovery checker.
//
// Run:  npx tsx workers/index.ts
//
// In production: deploy as a separate service/container.
// ============================================================
import "dotenv/config";
import { createImportWorker } from "@/lib/jobs/workers/import.worker";
import { createSyncWorker } from "@/lib/jobs/workers/sync.worker";
import { createWebhookWorker } from "@/lib/jobs/workers/webhook.worker";
import { startStuckJobChecker } from "@/lib/jobs/workers/stuck-job-checker";

console.log("═══════════════════════════════════════════════════");
console.log("  FinRP Workers starting");
console.log(`  REDIS_URL = ${process.env.REDIS_URL?.replace(/:[^:@]+@/, ":***@") ?? "(unset)"}`);
console.log(`  NODE_ENV  = ${process.env.NODE_ENV ?? "(unset)"}`);
console.log("═══════════════════════════════════════════════════");

const workers = [
  createImportWorker(),
  createSyncWorker(),
  createWebhookWorker(),
];

console.log(`[Workers] ${workers.length} workers started`);
console.log("  • import  worker (concurrency=3)");
console.log("  • sync    worker (concurrency=5)");
console.log("  • webhook worker (concurrency=10)");

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
