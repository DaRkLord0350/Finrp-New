// ============================================================
// FinRP — Account Aggregator Webhook (legacy URL)
// POST /api/webhooks/aa
// Kept for any provider configuration already pointing here.
// Delegates to the canonical handler at /api/webhooks/setu.
// ============================================================

export { POST } from "../setu/route";
