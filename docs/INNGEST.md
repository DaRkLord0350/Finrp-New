# Background Jobs with Inngest

FinRP runs **all** asynchronous work on [Inngest](https://www.inngest.com) —
durable execution, events, schedules (cron), retries and observability — with
**no Redis/BullMQ queues or long-running worker processes**. Redis is still used,
but **only** for the cache layer and the signup distributed lock (see
[`lib/redis.ts`](../lib/redis.ts) / [`lib/cache`](../lib/cache)).

## Architecture

```
producer (route / service)                 Inngest                 consumer (function)
  enqueueImport(...)            ──send──►  csv/import.requested  ──►  csvImport()
  enqueueBankSync(...)          ──send──►  bank/sync.requested   ──►  bankSync()
  enqueueEmail(...)             ──send──►  email/send            ──►  emailSend()
  inngest.send(...)            (PDF, tax, analytics, …)
  cron (every 5–30m / daily)   ──────────────────────────────────►  scheduled fns
```

| Path | Purpose |
| --- | --- |
| [`inngest/client.ts`](../inngest/client.ts) | The single `Inngest` client (id `finrp`). |
| [`inngest/events.ts`](../inngest/events.ts) | Event-name constants (`EVENTS`) + payload types. |
| [`inngest/functions/`](../inngest/functions) | One file per domain (import, sync, webhook, bank, tax, accounting, analytics, email, invoices, scheduled). |
| [`inngest/index.ts`](../inngest/index.ts) | The `functions[]` registry. |
| [`app/api/inngest/route.ts`](../app/api/inngest/route.ts) | `serve()` handler — `GET/POST/PUT /api/inngest`. |
| [`lib/jobs/background-job.ts`](../lib/jobs/background-job.ts) | `BackgroundJob` ledger helper (unified progress surface). |

Producers never import a function directly — they emit a typed event through an
`enqueue*` helper (unchanged signatures) or `inngest.send()`. Each function
re-reads its owning DB record and skips terminal states, so retries and
duplicate dispatches are idempotent.

> **Middleware / auth:** `/api/inngest` **must** be a public route in
> [`middleware.ts`](../middleware.ts) (it is, via `"/api/inngest(.*)"`). Inngest
> authenticates its own requests with `INNGEST_SIGNING_KEY`, so Clerk must not
> run on this path — otherwise `auth.protect()` returns **404** to the Dev
> Server / Inngest Cloud and discovery + sync silently fail.

## Event catalog

| Event | Trigger source | Function |
| --- | --- | --- |
| `csv/import.requested` | upload / mapping routes, stuck-job cron | `csvImport` |
| `csv/import.completed` | emitted by `csvImport` | (downstream listeners) |
| `integration/sync.requested` | integrations sync route, webhook, cron | `integrationSync` |
| `webhook/zoho.received` | Zoho webhook route | `webhookZoho` |
| `bank/sync.requested` | banking routes, AA webhook, cron | `bankSync` |
| `bank/import.requested` | bank statement upload route | `bankImport` |
| `tax/job.requested` | tax compute dispatch | `taxJob` |
| `accounting/bulk-update.requested` | bulk account update service | `bulkAccountUpdate` |
| `analytics/snapshot.requested` | post-mutation hooks, nightly cron | `analyticsSnapshot` |
| `invoice/pdf.generate` | invoice send route | `invoicePdf` |
| `email/send` | every email path (`enqueueEmail`) | `emailSend` |

### Schedules (cron)

| Function | Schedule | Replaces |
| --- | --- | --- |
| `bankAutoSync` | every 30 min | BullMQ `bank-auto-sync-scan` repeatable |
| `recurringInvoiceScan` | hourly | BullMQ recurring-invoice repeatable |
| `integrationScheduledSync` | every 15 min | per-integration `scheduleRepeatingSync` |
| `complianceReminders` | daily 08:00 IST | _new_ — GST/TDS/IT/ROC reminders |
| `analyticsNightly` | daily 02:00 UTC | BullMQ `all_orgs` repeat |
| `stuckJobChecker` | every 5 min | `setInterval` stuck-job checker |

## Local development

Run the Next.js app and the Inngest Dev Server together:

```bash
npm run dev:all
# └─ next dev            → http://localhost:3000
# └─ inngest-cli dev     → http://localhost:8288   (-u http://localhost:3000/api/inngest)
```

Or in two terminals:

```bash
npm run dev       # Next.js
npm run inngest   # Inngest Dev Server (auto-discovers /api/inngest)
```

Open the **Dev Server dashboard at http://localhost:8288** to see every
registered function, send test events, trigger runs and inspect step-by-step
execution. No keys are required in dev.

## MCP integration (Claude Code / AI tooling)

The Inngest Dev Server exposes an MCP endpoint at **`http://localhost:8288/mcp`**.
This repo ships a project-scoped [`.mcp.json`](../.mcp.json) so Claude Code picks
it up automatically when the dev server is running. To register it manually
instead:

```bash
claude mcp add --transport http inngest-dev http://localhost:8288/mcp
```

Through MCP the assistant can:

- **list** registered functions,
- **invoke** functions,
- **send** test events,
- **inspect** a run's steps/output,
- **monitor** runs in real time,
- **search** the Inngest documentation.

> The MCP server is only available while `npm run inngest` (the Dev Server) is
> running on port 8288.

## Production

Deploy the app normally; the serve handler at `/api/inngest` is the single
integration point. Set these environment variables (never commit secrets):

| Variable | Purpose |
| --- | --- |
| `INNGEST_EVENT_KEY` | Authenticates `inngest.send()` to Inngest Cloud. |
| `INNGEST_SIGNING_KEY` | Verifies invocations to the serve handler. |

Then [sync the app](https://www.inngest.com/docs/deploy) so Inngest discovers
`https://<your-domain>/api/inngest`. Crons and event routing run from Inngest
Cloud — there is no separate worker service to deploy.
