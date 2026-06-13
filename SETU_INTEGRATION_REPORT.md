# FinRP — Setu AA Integration: Implementation, Security & Readiness Report

> Companion to [BANKING_SETU_AUDIT.md](./BANKING_SETU_AUDIT.md) (Phase 1–2 audit).
> Implemented 2026-06-13 on branch `feature`. TypeScript: 0 errors. Tests: 32/32 passing.

---

## 1. What was implemented

### Database (2 migrations, applied + verified against Supabase)

| Migration | Contents |
|-----------|----------|
| `20260613000000_banking_setu_aa` | `bank_sync_history` (per-run audit trail), `bank_balances` (point-in-time snapshots, unique per account/day/source), `bank_webhook_events` (idempotency + audit store), `BankConsent` lifecycle columns (vua-masked, approvedAt/revokedAt/rejectedAt, lastDataFetchAt, createdById, deletedAt), `BankAccount.linkedAccountRef` (AA link mapping), 14 new indexes |
| `20260613000100_bank_txn_external_id` | `BankTransaction.externalTxnId` + unique `(bankAccountId, externalTxnId)` — race-safe AA dedup via `createMany(skipDuplicates)`; `ClientPermission.MANAGE_CONSENTS` enum value |

### Provider layer (Phase 4)

```
lib/banking/providers/
├── types.ts           BankingProvider interface + normalized DTOs + BankingProviderError
├── setu.provider.ts   Setu FIU v2 client (/v2/consents, /v2/sessions)
└── index.ts           getBankingProvider() registry — future AAs plug in here
```

- 30s timeouts (AbortController), ≤3 retries with exponential backoff + jitter,
  `Retry-After` honored on 429, no retry on 4xx, `x-request-id` per call,
  structured logs via `lib/banking/logger.ts` (auto-redacts secret-like keys).
- **The mock FI path and placeholder ECDH key material are gone** — Setu's FIU
  "Data" product decrypts FI payloads server-side; the provider consumes the
  decrypted v2 session payload with a defensive parser (`parseFIPayload`).

### Services

- `lib/banking/consent-service.ts` — initiate (audit-logged, VUA masked before
  storage), refresh status from provider (never trusts redirect params), account
  discovery/upsert via `linkedAccountRef`, revoke (provider + DB + audit).
- `lib/banking/sync-service.ts` — single sync entry point for initial /
  incremental / scheduled / webhook-driven runs. Writes `BankSyncHistory`,
  3-day incremental overlap, bulk-insert dedup, `BankBalance` snapshots, then
  the existing pipeline (duplicate marking → rules categorization → risk
  detection → ledger balance update).
- `lib/banking/webhook-service.ts` — normalizes Setu-native events
  (`CONSENT_STATUS_UPDATE`/`SESSION_STATUS_UPDATE`) AND canonical names to one
  vocabulary; stores every payload; replay window 10 min; dedup by unique
  `externalId` (provider notification id, else body hash).
- `lib/banking/queue.ts` — `finrp-bank-sync` queue helpers with deterministic
  job ids (5-min dedup buckets; session-scoped keys for webhook syncs) +
  repeatable 30-min auto-sync scan.
- `lib/banking/consent-guard.ts` — owner-only guard for consent mutations.
- `lib/banking/setu/config.ts` — validated env config; **fixes the silent
  credential bug** (`SETU_SECRET`/`SETU_AA_ENV` are now actually read).

### API routes

| Route | Change |
|-------|--------|
| `POST /api/webhooks/setu` | **New** canonical webhook (signature → replay → idempotency → routing) |
| `POST /api/webhooks/aa` | Now an alias of the above |
| `POST /api/banking/setu/connect` | Rewired to consent-service + consent guard; structured 422/429/502/503 errors |
| `GET /api/banking/setu/callback` | Verifies status with provider, enqueues initial sync, redirects to consent page with status |
| `POST /api/banking/setu/refresh` | Enqueues incremental sync (202) |
| `POST/GET /api/banking/sync` | Uses central queue helper; consent-aware |
| `GET /api/banking/consents` | **New** — consent list |
| `GET/DELETE /api/banking/consents/[id]` | **New** — detail + sync runs / revoke (guarded) |
| `GET /api/banking/sync-history` | **New** — cursor-paginated run history |
| `GET /api/banking/transactions/[id]/suggestions` | **New** — ranked invoice/payment/expense matches + bank-charge account suggestion |

### Workers
`workers/index.ts` now starts `bank-sync` + `bank-import` workers (**they were
never started before — queued syncs hung forever**) and registers the
repeatable auto-sync scan (accounts with `autoSyncEnabled` past `nextSyncAt`,
200-account cap per scan).

### UI
- **Consent Manager** rebuilt on the consents API: callback status banners,
  real start dates, account-scoped Renew, two-step Revoke, error surfaces.
- **Sync History** page (new) with status filters + failure detail; sidebar entry added.
- **CA Hub Client 360 → Banking tab**: real capability matrix (what a CA can do
  via workspace vs. owner-only consent actions).
- `useBankConsents` / `useBankSyncHistory` hooks (project's queryCache pattern).

### Accounting integration (Phase 10)
- Reconciliation engine debit branch now also matches **Expenses**
  (amount+tax tolerance, vendor-name confidence).
- Suggestions endpoint powers "Invoice Paid → Auto Match", "Expense Detected →
  Categorize", "Bank Charge → Suggest Account".

---

## 2. Security review (Phase 11)

| Area | Status | Notes |
|------|--------|-------|
| Secrets handling | ✅ | All Setu vars validated at first use; never logged (logger redacts `secret/token/signature/vua` keys); legacy alias supported |
| Webhook validation | ✅ | HMAC-SHA256 (hex/base64) with `timingSafeEqual`; production rejects unsigned; sandbox accepts but flags `signatureValid=false` |
| Replay protection | ✅ | 10-min timestamp window + unique `externalId` (provider id or body hash) — replays return 200 without re-processing |
| RBAC | ✅ | All banking APIs behind Clerk auth + `getTenantId()` (workspace-aware). CA reads gated by `MANAGE_BANKING`; consent create/revoke/disconnect require explicit `MANAGE_CONSENTS` (not in assignment defaults) |
| Audit logging | ✅ | Consent create/revoke → `AuditLog`; CA workspace mutations → `ClientActivityLog`; every webhook → `BankWebhookEvent`; every sync → `BankSyncHistory` |
| PII handling | ✅ | VUA masked before persistence (`XXXXXXXX99@onemoney`); account numbers stored as provider-masked values for AA-discovered accounts; FI raw payloads NOT persisted (only parsed rows) |
| Financial data protection | ✅ | Tenant scoping on every query; unique constraints prevent cross-sync duplication; decimal types end-to-end |
| Multi-tenant isolation | ✅ | Webhooks resolve org via consent lookup; unknown consents stored with `organizationId=null` and never processed against a tenant |

**Remaining risks / recommendations**
1. `BankConnection.accessToken/refreshToken` (Plaid legacy path) are plaintext
   columns — Setu flow doesn't use them, but encrypt-at-rest via the existing
   AES-GCM helper is recommended before Plaid goes live.
2. Confirm Setu's signature header name for your product instance when
   onboarding (route checks `x-setu-signature`, `x-jws-signature`,
   `x-webhook-signature`).
3. Consider Postgres RLS as defense-in-depth (Supabase advisors will flag this).

---

## 3. Test plan & results (Phase 12)

**Framework:** vitest (installed, `npm test`). 32 unit tests, all passing:

| Suite | Covers |
|-------|--------|
| `tests/unit/setu-config.test.ts` (6) | Missing-var fail-fast, sandbox/prod URL mapping, prod webhook-secret requirement, legacy fallback, base-URL override |
| `tests/unit/setu-provider.test.ts` (13) | Webhook HMAC verify (hex/base64/tamper/wrong-secret/unsigned prod+sandbox), FI payload parsing (accounts/balances/txns, synthesized dedup ids, malformed-row skip), HTTP retry on 429, no-retry on 4xx, malformed-response error, auth headers |
| `tests/unit/webhook-normalize.test.ts` (13) | Event mapping (all consent + session statuses), canonical passthrough, unknown-type safety, batched notifications, idempotency key derivation, timestamp parsing |

**Integration tests to add when a sandbox DB/credentials are available** (documented, not yet automated):
- Consent E2E: connect → Setu sandbox approval → callback → initial sync → rows in `BankTransaction`/`BankBalance`/`BankSyncHistory`.
- Webhook E2E: signed `SESSION_STATUS_UPDATE` → enqueued sync → dedup on redelivery.
- Permission tests: CA without `MANAGE_CONSENTS` gets 403 on connect/revoke; with grant succeeds; customer always succeeds.
- Sync dedup under concurrency: two parallel syncs for one account → no duplicate `externalTxnId` rows (DB constraint enforces).

---

## 4. Sandbox readiness checklist (Phase 13)

| Item | Status |
|------|--------|
| ✓ Webhook URL ready | **Yes** — `https://<app-domain>/api/webhooks/setu` (use ngrok/tunnel for local) |
| ✓ Database ready | **Yes** — all migrations applied to Supabase; schema verified |
| ✓ APIs ready | **Yes** — consent, callback, refresh, sync, consents CRUD, sync-history, suggestions |
| ✓ Consent flow ready | **Yes** — create → hosted redirect → callback → initial sync → status UI |
| ✓ Banking dashboard ready | **Yes** — 17 pages incl. new Sync History; consent manager rebuilt |
| ✓ CA Hub ready | **Yes** — workspace-gated access + owner-only consent boundary |
| ✓ Env vars | **Yes** — all 5 present in `.env.local` (sandbox values) |
| ⚠ Logo URL / branding | **Action needed** — host a public logo URL and set product branding in Setu's Bridge dashboard |
| ⚠ Bridge product config | **Action needed** — configure consent template (purpose 101, fiTypes DEPOSIT, 12-month duration, PERIODIC fetch) + webhook URL + webhook secret in The Bridge; values must match `.env` |

## 5. Production readiness

| Item | Status |
|------|--------|
| Provider abstraction | ✅ pluggable registry |
| Retries / timeouts / rate limits | ✅ in provider HTTP core |
| Idempotency | ✅ webhook externalId unique, deterministic BullMQ job ids, txn dedup constraint |
| Failure visibility | ✅ BankSyncHistory + Sync History UI + Sentry tags |
| Scheduled refresh | ✅ repeatable scan every 30 min (worker process must run: `npm run worker`) |
| Env separation | ✅ `SETU_AA_ENV=production` flips base URL + enforces webhook secret |
| Open items | Plaid token encryption; Setu signature header confirmation; integration test suite vs sandbox; deploy worker as separate service |

## 6. Operational notes

- Local dev: `npm run dev:all` (web + workers). Without the worker process,
  syncs queue but never execute.
- Webhook + queue depend on `REDIS_URL`; webhook events are still stored if
  Redis is down (status `FAILED`, retriable from the event row).
- `npm test` runs the unit suite; tests stub all network/DB access.
