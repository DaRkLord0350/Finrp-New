// ============================================================
// FinRP — Workers Entry Point
// Long-running Node.js process that starts all BullMQ workers.
// Run with: npx ts-node --transpile-only workers/index.ts
// Or:        npx tsx workers/index.ts
//
// In production: deploy as a separate service/container so it
// doesn't compete with the Next.js web server for resources.
// ============================================================

import { createImportWorker } from "@/lib/jobs/workers/import.worker";
import { createSyncWorker } from "@/lib/jobs/workers/sync.worker";
import { createWebhookWorker } from "@/lib/jobs/workers/webhook.worker";

const workers = [
  createImportWorker(),
  createSyncWorker(),
  createWebhookWorker(),
];

console.log(`[Workers] Started ${workers.length} workers`);
console.log("  • import worker  (concurrency=3)");
console.log("  • sync worker    (concurrency=5)");
console.log("  • webhook worker (concurrency=10)");

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Workers] Received ${signal}. Shutting down gracefully…`);

  // Close all workers — they will finish active jobs before stopping
  await Promise.all(workers.map((w) => w.close()));

  console.log("[Workers] All workers stopped. Exiting.");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("[Workers] Uncaught exception:", err);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("[Workers] Unhandled rejection:", reason);
});
