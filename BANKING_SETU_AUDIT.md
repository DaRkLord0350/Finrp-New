# FinRP — Setu Account Aggregator Integration Audit

> Phase 1–2 deliverable. Audited 2026-06-13 against branch `feature`.
> Scope: auth, tenancy, banking, accounting, reconciliation, permissions,
> webhooks, jobs, integrations, Prisma schema, API + frontend architecture,
> environment configuration.

---

## 1. Current Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Next.js 16 App Router                       │
│                                                                      │
│  (dashboard)/banking/*   (ca-hub)/*        (customer)/* (ca)/* etc.  │
│  16 banking pages        14 CA modules                               │
│        │                       │                                     │
│        ▼                       ▼                                     │
│  hooks/useBank*  ──────  lib/queryCache (custom, not react-query)    │
│        │                                                             │
│        ▼                                                             │
│  app/api/banking/* (27 routes)   app/api/webhooks/{aa,plaid,clerk,   │
│        │                          zoho}                              │
│        ▼                                                             │
│  Clerk auth() → lib/auth/tenant.getTenantId()                        │
│        │            └─ lib/workspace/context (CA impersonation:      │
│        │               signed cookie + ClientAssignment + per-route  │
│        │               ClientPermission gate + ClientActivityLog)    │
│        ▼                                                             │
│  lib/banking/* (service layer)    lib/repositories/* (older modules) │
│        │                                                             │
│        ▼                                                             │
│  Prisma 7 (adapter-pg) → PostgreSQL          Redis (cache + BullMQ)  │
│                                                                      │
│  workers/index.ts → import / sync / webhook workers + stuck-job      │
│  checker (separate Node process via `npm run worker`)                │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Banking Architecture (as found)

```
lib/banking/
├── integrations/
│   ├── setu-aa.ts          ← function-based Setu client (gaps below)
│   ├── plaid-client.ts     ← Plaid (no `plaid` npm pkg installed)
│   └── statement-parser.ts ← CSV/Excel/PDF statement import
├── reconciliation-engine.ts ← auto/manual/partial matching (Invoice, Payment)
├── categorization-engine.ts ← BankingRule conditions/actions
├── cash-flow-calculator.ts
├── duplicate-detector.ts
├── insight-generator.ts / risk-detector.ts (AI insights, risk alerts)
├── ledger-integration.ts   ← balance updates, accounting hooks
└── workers/
    ├── bank-sync.worker.ts   (queue: finrp-bank-sync)
    └── bank-import.worker.ts (queue: finrp-bank-import)

Prisma models (already migrated): BankAccount, BankTransaction, BankingRule,
BankReconciliationSession, ReconciliationMatch, BankConsent, BankConnection,
BankStatementImport, CashFlowSnapshot, GSTBankMatch, BankRiskAlert,
BankAIInsight, WebhookEvent (generic).
```

## 3. Findings — Gaps & Defects

### Critical (broken today)

| # | Finding | Impact |
|---|---------|--------|
| C1 | **Env var mismatch**: code reads `SETU_AA_BASE_URL` / `SETU_CLIENT_SECRET`; `.env` defines `SETU_AA_ENV` / `SETU_SECRET`. | Setu client silently runs with empty credentials — every live call 401s. |
| C2 | **Bank workers never started**: `workers/index.ts` starts import/sync/webhook workers only; `createBankSyncWorker` / `createBankImportWorker` are never invoked. | Queued bank syncs sit in Redis forever; UI shows "SYNCING" indefinitely. |
| C3 | **Mock FI fetch in production path**: `fetchAndStoreTransactions()` calls `mockFetchFIDataForAccount()` which GETs `/FI/fetch/{consentId}` without a data session. | No transaction data can ever be fetched, even with valid credentials. |
| C4 | **Placeholder ECDH key material**: `requestFIData()` sends literal string `"Base64URL(clientPublicKey=...)"`. | FI request rejected by AA. (Note: Setu **FIU "Data" product** handles encryption server-side — the fix is to use Setu's v2 FIU API, not raw AA spec endpoints.) |
| C5 | **Wrong API shape**: code targets raw ReBIT AA gateway endpoints (`/Consent`, `/FI/request`) with `x-client-id` headers, but the product instance ID env var implies Setu's **FIU v2 API** (`/v2/consents`, `/v2/sessions`) — these are incompatible. | Integration cannot work against either API as written. |

### High (functional gaps vs. requirements)

| # | Finding |
|---|---------|
| H1 | No `BankSyncHistory` model — sync runs aren't recorded (no failure tracking, no history UI). |
| H2 | No `BankBalance` model — only mutable `currentBalance` on BankAccount; no balance time series for cash-flow accuracy. |
| H3 | Webhook handler (`/api/webhooks/aa`) doesn't store events (WebhookEvent unused — requires `integrationId`, AA has no Integration row), no replay protection, no idempotency, processes synchronously inline. |
| H4 | No `/api/webhooks/setu` route (required URL for Setu dashboard registration). |
| H5 | No provider abstraction — Setu functions imported directly by routes/worker; Plaid duplicated alongside. No retries, timeouts, or rate-limit handling in any Setu call. |
| H6 | Consent callback never triggers initial sync (only flips `autoSyncEnabled`); no data session is ever created after consent approval. |
| H7 | No scheduled refresh: `nextSyncAt` is set but nothing reads it (no repeatable BullMQ job for banking). |
| H8 | `BankConsent` has no audit fields (createdBy), no soft delete, no `consentExpiry` vs `dataRange` distinction, no raw payload storage. |
| H9 | Consent page has no revoke action; "Renew" buttons call `connectSetu()` with **no arguments** so `bankAccountId` is lost. |
| H10 | No test framework installed (only k6 load scripts) — Phase 12 needs vitest + test suite. |

### Medium

- `syncConsentStatus` `prisma.update` throws if consent handle unknown (webhook for foreign consent → 500 path).
- `fetchAndStoreTransactions` does per-txn `findFirst` + `create` (N+1); no unique constraint on `(bankAccountId, referenceNumber)` so concurrent syncs can duplicate.
- `BankConnection.accessToken/refreshToken` stored in plaintext columns (encryption helper exists but Setu path never uses it; Plaid path encrypts).
- Sandbox/production separation: single `SETU_AA_ENV` exists but nothing maps it to base URLs.
- `app/(dashboard)/banking/consent/page.tsx` start date column hardcoded "—".

## 4. What is solid and must be reused

- **Tenancy**: `getTenantId()` (Redis-cached, workspace-override aware) — every banking route already uses it.
- **CA access**: `ClientAssignment.permissions` + `MANAGE_BANKING` route gate via `lib/workspace/permissions.ts`; all `/api/banking/*` calls from an impersonating CA are already permission-gated + audit-logged. Consent/disconnect endpoints need an additional **owner-only** guard.
- **Crypto**: `lib/crypto/token-encryption.ts` (AES-256-GCM, `ENCRYPTION_KEY`).
- **Audit**: `lib/audit.createAuditLog` (+ `ClientActivityLog` for CA actions).
- **Jobs**: BullMQ queue registry pattern in `lib/jobs/queues/index.ts` (deterministic jobIds for idempotency, DLQ in `lib/jobs/queues/dlq.ts`).
- **Validation**: zod schemas in `lib/banking/validations.ts`.
- **Reconciliation/categorization/risk/insight engines** — fully reusable post-sync pipeline.
- **UI design system**: CSS variables (`var(--bg-card)`, `var(--border)`, `var(--text-*)`) with inline styles, lucide icons, custom `lib/queryCache` hooks.

## 5. Environment / Setu Readiness (Phase 2)

| Variable | In .env | Used by code (before fix) | Status |
|----------|---------|---------------------------|--------|
| `SETU_AA_ENV` | ✅ `sandbox` | ❌ never read | wired up in `lib/banking/setu/config.ts` |
| `SETU_CLIENT_ID` | ✅ | ✅ | ok |
| `SETU_SECRET` | ✅ | ❌ code read `SETU_CLIENT_SECRET` | fixed |
| `SETU_PRODUCT_INSTANCE_ID` | ✅ | ✅ | ok |
| `SETU_WEBHOOK_SECRET` | ✅ | ✅ (webhook only) | ok |

Decisions: centralized, validated config module (`lib/banking/setu/config.ts`)
maps `SETU_AA_ENV` → base URL (`https://fiu-sandbox.setu.co` / `https://fiu.setu.co`),
fails fast with a clear error when a required var is missing, and supports the
legacy `SETU_CLIENT_SECRET` name as fallback.

## 6. Implementation Strategy (executed in this change)

1. **Phase 3 — Schema**: add `BankSyncHistory`, `BankBalance`, `BankWebhookEvent`
   (standalone — generic `WebhookEvent` requires an `Integration` row that AA
   flows don't have); extend `BankConsent` with audit/lifecycle fields. Additive
   migration only — no destructive changes.
2. **Phase 4 — Provider layer**: `lib/banking/providers/types.ts`
   (`BankingProvider` interface) + `lib/banking/providers/setu.provider.ts`
   implementing Setu **FIU v2 API** (`/v2/consents`, `/v2/sessions`) with
   OAuth-style header auth, retry w/ exponential backoff + jitter, timeouts,
   429 handling, structured logging (`lib/banking/logger.ts`), idempotent
   persistence. Registry: `getBankingProvider("SETU")`.
3. **Phase 5 — Webhooks**: `POST /api/webhooks/setu` — HMAC verification,
   replay window, `BankWebhookEvent` dedup by `externalId`, async processing,
   full event-type coverage; keep `/api/webhooks/aa` as a thin alias.
4. **Phase 6–7 — Consent + sync**: callback triggers initial sync; sync engine
   records `BankSyncHistory` rows; scheduled refresh via repeatable BullMQ job;
   dedup via upsert on `(bankAccountId, externalTxnId)`.
5. **Phase 8–9 — UI + CA Hub**: wire consent revoke/renew with account context,
   sync history page, CA Hub client banking tab; owner-only guard on
   consent create/revoke/disconnect.
6. **Phase 10 — Accounting**: reuse reconciliation engine; extend to Expense
   matching + suggestion endpoint.
7. **Phase 11–13**: security review, vitest suite, readiness reports →
   `SETU_INTEGRATION_REPORT.md`.
