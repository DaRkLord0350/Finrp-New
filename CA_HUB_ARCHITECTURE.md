# CA Hub — Chartered Accountant Practice Operating System

> A world-class practice-management super-module inside FinRP, inspired by Zoho Books
> Accountant Edition, Karbon, Canopy, TaxDome and ClearTax — built natively on the
> existing FinRP stack (Next.js 16 App Router · TypeScript · Tailwind v4 · shadcn/ui ·
> Prisma · PostgreSQL · Clerk · BullMQ · Redis · Gemini).

---

## 1. Vision

Transform FinRP from a business ERP/CRM into a complete **CA Practice Operating System**:
one workspace where a firm manages every client's compliance, filings, audit, documents,
team and analytics — with an AI copilot threaded throughout.

The CA Hub is a **top-level module** reachable from the CA and Firm portals via a
prominent launcher, with its own shell, sidebar and 14 sub-modules.

---

## 2. Architecture decisions

| Decision | Rationale |
|---|---|
| **Dedicated route group `app/(ca-hub)/`** | Parallels the existing `(ca)`, `(firm)`, `(admin)`, `(dashboard)` portals. Keeps URLs clean (`/ca-hub/...`) and isolates the shell. |
| **RBAC at the layout** | `app/(ca-hub)/layout.tsx` calls `getCurrentUser()` and redirects `CUSTOMER` → `/dashboard`; allows `CA`, `CA_FIRM_ADMIN`, `ADMIN`. Mirrors every other portal guard — no new auth primitive. |
| **Multi-tenant by `firmId` + `organizationId`** | Practice data is scoped to the **firm** (the CA tenant); each filing also carries the **client** `organizationId`. APIs resolve `firmId` from the signed-in user. |
| **Additive Prisma models** | New `ca_hub_*` tables use scalar FKs + indexes (no back-relations on the 100+ core models) → the schema block drops in without touching existing models. `prisma validate` + `generate` pass clean. |
| **Demo-data layer with live-swap path** | `lib/ca-hub/demo-data.ts` lets every page render as a polished wireframe **before** the migration runs. The reference API (`/api/ca-hub/dashboard`) shows the exact live-query shape and falls back to demo data until tables exist. |
| **Design-system reuse** | CSS-variable + inline-style convention, recharts, lucide, INR formatting — identical to Banking OS, so the module is visually native. Added `--bg-card` / `--bg-hover` token aliases (were referenced but undefined). |

---

## 3. Production folder structure

```
app/
├─ (ca-hub)/                        # ← new RBAC-gated portal route group
│  ├─ layout.tsx                    # server guard (CA | CA_FIRM_ADMIN | ADMIN)
│  ├─ CAHubShell.tsx                # client shell: sidebar + header + <main>
│  ├─ loading.tsx                   # skeleton
│  ├─ error.tsx                     # error boundary
│  └─ ca-hub/
│     ├─ page.tsx                   # ① Multi-Client Practice Dashboard  (flagship)
│     ├─ clients/
│     │  ├─ page.tsx                # ② Client Portfolio (compliance matrix)
│     │  └─ [id]/page.tsx           #    Client 360 (11 tabs)
│     ├─ compliance/page.tsx        # ③ Compliance Command Center (calendar)
│     ├─ gst/page.tsx               # ④ GST Command Center (bulk filing + ITC)
│     ├─ income-tax/page.tsx        # ⑤ Income Tax Center
│     ├─ tds/page.tsx               # ⑥ TDS Center
│     ├─ audit/page.tsx             # ⑦ Audit Workspace
│     ├─ roc/page.tsx               # ⑧ ROC & MCA Center
│     ├─ documents/page.tsx         # ⑨ Document Vault
│     ├─ client-portal/page.tsx     # ⑩ Client Portal
│     ├─ esign/page.tsx             # ⑪ eSign Center
│     ├─ team/page.tsx              # ⑫ Team Management
│     ├─ analytics/page.tsx         # ⑬ Practice Analytics
│     └─ copilot/page.tsx           # ⑭ AI CA Copilot (chat)
└─ api/
   └─ ca-hub/
      └─ dashboard/route.ts         # reference API (withTenant + aggregates)

components/ca-hub/
├─ CAHubSidebar.tsx                 # grouped rail nav (14 modules + status badges)
├─ CAHubHeader.tsx                  # module-aware breadcrumb + search + UserButton
└─ ui.tsx                           # presentational kit (Kpi, Panel, FilingPill,
                                     # RiskPill, FeatureGrid, ModuleLanding, …)

lib/ca-hub/
├─ nav.ts                           # single source of truth: 14 modules × sub-items
└─ demo-data.ts                     # representative data + types + format helpers

prisma/schema.prisma                # + "CA HUB" section (13 models, 11 enums)
```

---

## 4. Data models (`prisma/schema.prisma` → CA HUB section)

All tables prefixed `ca_hub_*`. Tenant keys: `firmId` (practice), `organizationId` (client).

| Model | Purpose | Key fields |
|---|---|---|
| `ClientComplianceProfile` | Per-client scorecard (Client 360 + dashboard) | `healthScore`, `riskLevel`, `gst/tds/itr/roc/audit/payrollStatus`, `monthlyFee` |
| `GstFiling` | GSTR-1/3B/9/9C/CMP08/IFF | `returnType`, `periodLabel`, `taxableValue`, `taxLiability`, `itcClaimed`, `dueDate`, `arn` |
| `ItrFiling` | ITR 1–7 | `formType`, `assessmentYear`, `regime`, `taxPayable`, `refundDue`, `aisImported`, `acknowledgementNo` |
| `TdsReturn` | 24Q/26Q/27Q/27EQ | `formType`, `quarter`, `financialYear`, `totalDeducted/Deposited`, `challanMatched`, `tokenNumber` |
| `AuditEngagement` | Statutory/Tax/Internal/GST audits | `type`, `status`, `riskRating`, `udin`, `materiality`, `signOffAt` |
| `AuditWorkpaper` | Indexed working papers (→ engagement) | `ref`, `area`, `status`, `preparedById`, `reviewedById`, `conclusion` |
| `RocFiling` | AOC-4/MGT-7/DIR-3 KYC/LLP forms | `formType`, `cin`, `srn`, `feePaid`, `dueDate` |
| `CaVaultDocument` | OCR + versioning + DigiLocker | `category`, `version`, `tags[]`, `ocrText`, `source`, `isConfidential` |
| `CaEsignRequest` | Aadhaar / DSC signing | `signType`, `status`, `signerEmail`, `sentAt`, `signedAt` |
| `CaTimesheet` | Billable hours (productivity) | `caUserId`, `date`, `hours`, `billable`, `activity` |
| `CaCopilotThread` / `CaCopilotMessage` | AI conversations | `domain`, `role`, `content` |
| `PracticeMetricSnapshot` | Analytics rollups | `totalClients`, `gstDue`, …, `revenueMTD`, `realizationRate`, `teamUtilization` |

**Enums:** `CaFilingStatus`, `CaRiskLevel`, `GstReturnType`, `ItrFormType`, `TaxRegime`,
`TdsFormType`, `AuditEngagementType`, `AuditEngagementStatus`, `RocFormType`,
`CaEsignType`, `CaEsignStatus`, `CaCopilotRole`, `CaCopilotDomain`.

---

## 5. API architecture

Every endpoint follows the existing FinRP pattern — thin handler wrapped in
`withTenant()` (Clerk auth + tenant resolution), aggregating with SQL, returning JSON.

```ts
export const GET = withTenant(async (_req, { userId }) => {
  const { firmId } = await resolveFirm(userId);
  const [gstDue, tdsDue, ...] = await prisma.$transaction([ /* COUNTs scoped by firmId */ ]);
  return NextResponse.json({ kpis: { gstDue, tdsDue, ... } });
});
```

Reference implementation: **`app/api/ca-hub/dashboard/route.ts`** (live + graceful fallback).

Planned endpoint map (one folder per module):

```
/api/ca-hub/dashboard          GET    practice KPIs
/api/ca-hub/clients            GET    portfolio list (filter/sort/paginate)
/api/ca-hub/clients/[id]       GET    client 360 aggregate
/api/ca-hub/compliance         GET    deadline ledger + risk
/api/ca-hub/gst                GET/POST   filings; POST = bulk-file job → BullMQ
/api/ca-hub/income-tax         GET/POST   ITR filings; POST /ais = import
/api/ca-hub/tds                GET/POST   returns; /challan-recon
/api/ca-hub/audit              GET/POST   engagements + workpapers; /udin
/api/ca-hub/roc                GET/POST   MCA filings
/api/ca-hub/documents          GET/POST   vault (presigned upload, OCR job)
/api/ca-hub/esign              POST   create request; webhook callback
/api/ca-hub/team               GET    productivity + timesheets
/api/ca-hub/analytics          GET    snapshots / trends
/api/ca-hub/copilot            POST   stream Gemini (lib/gemini.ts) with practice context
```

Long-running work (bulk filing, OCR, AIS import, snapshot rollups) → **BullMQ workers**
(`workers/`), consistent with the import/banking pipelines.

---

## 6. Sidebar navigation

`lib/ca-hub/nav.ts` is the single source of truth (also feeds breadcrumbs + landing pages).
The rail (`CAHubSidebar`) groups the 14 modules:

```
Practice      → Practice Dashboard · Client Portfolio
Compliance    → Compliance Center
Filings       → GST · Income Tax · TDS
Assurance     → Audit Workspace · ROC & MCA
Workspace     → Document Vault · Client Portal · eSign Center
Intelligence  → Team Management · Practice Analytics · AI CA Copilot
```

Each item shows an accent-tinted icon, active state, and a `LIVE` / `BETA` / `SOON` badge.
The CA and Firm portal sidebars carry a gradient **"CA Hub" launcher** (`/ca-hub`).

---

## 7. Page & component hierarchy

```
(ca-hub)/layout.tsx  [server, RBAC]
└─ CAHubShell  [client]
   ├─ CAHubSidebar  ── lib/ca-hub/nav.ts
   ├─ CAHubHeader   ── ThemeToggle · UserButton
   └─ <page>
      ├─ ui.tsx → PageHeader · Kpi · Panel · FilingPill · RiskPill ·
      │            DueChip · MiniProgress · FeatureGrid · ModuleLanding
      ├─ recharts (Area / Bar / Pie)
      └─ lib/ca-hub/demo-data.ts  (→ live Prisma queries)
```

Lighter modules render via **`<ModuleLanding slug=… kpis=… />`** (hero + KPI row +
feature grid + roadmap) — ~12 lines each, fully consistent.

---

## 8. Dashboard wireframe (flagship)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ◆ Practice Dashboard            [This Month ▾] [Clients] [+ New Client]     │
├───────────────────────────────────────────────────────────────────────────┤
│ ⚠ 6 filings overdue across 5 clients — immediate attention      [Resolve →]│
├──────────────┬──────────────┬──────────────┬──────────────────────────────┤
│ Total Clients│   GST Due    │   TDS Due    │   ITR Due                     │ KPI row 1
│   184  ▲4.6% │     47       │     23       │     61                        │
├──────────────┼──────────────┼──────────────┼──────────────────────────────┤
│   ROC Due 12 │ Audit Pend 9 │ Rev ₹28.4L ▲ │ On-time 96.1%                 │ KPI row 2
├──────────────────────────────────────────┬────────────────────────────────┤
│  Revenue Analytics (billed vs collected) │  Filing Status (donut)          │
│  ╱╲___╱╲__ area chart, 12 months ________ │  ● Filed 693 ● Ready 58 …       │
├──────────────────────────────────────────┼────────────────────────────────┤
│  Compliance Load (stacked bars by cat.)  │  Team Productivity (util bars)  │
├───────────────────────────────────────────────────────────────────────────┤
│  Upcoming Deadlines   client · obligation · category · due · status · who  │
├──────────────┬──────────────┬──────────────┬──────────────────────────────┤
│ Revenue YTD  │     WIP      │ Realization  │ Utilization                   │
└──────────────┴──────────────┴──────────────┴──────────────────────────────┘
```

---

## 9. Activating live data

```bash
# 1. Create + apply the migration (dev)
npx prisma migrate dev --name ca_hub

# 2. (already done) regenerate the client
npx prisma generate

# 3. Point the dashboard fetch at the live endpoint
#    The page currently reads lib/ca-hub/demo-data.ts; swap to
#    GET /api/ca-hub/dashboard (already returns live data when tables exist).
```

Seed representative rows by extending `prisma/seed.ts` with `ca_hub_*` inserts.

---

## 10. Implementation roadmap

**Phase 0 — Foundation (this delivery)** ✅
Route group + RBAC shell · 14-module sidebar · flagship dashboard · Client Portfolio +
Client 360 · Compliance, GST & Copilot built out · 9 module landings · 13 Prisma models +
11 enums · reference API · design tokens · docs. *Type-checks & lints clean.*

**Phase 1 — Make it live**
Migrate `ca_hub_*` · repository layer (`lib/repositories/ca-hub.*`) · wire dashboard +
clients + compliance to live queries · seed data · cursor pagination + Redis cache.

**Phase 2 — Filings depth**
GST: GSTR-1/3B builders, GSTP/GSP gateway, ITC recon engine, e-invoice/e-way IRN.
ITR: AIS/TIS parser, computation engine, old-vs-new optimizer, bulk e-file.
TDS: TRACES integration, Form 16/16A PDF gen, OLTAS challan matching.

**Phase 3 — Assurance & MCA**
Audit: workpaper templates, sampling, CARO 2020 checklist, 3CA/3CB/3CD, UDIN minting.
ROC: AOC-4/MGT-7/DIR-3 KYC prefill, MCA V3 tracker.

**Phase 4 — Workspace & collaboration**
Document Vault (OCR via worker, versioning, expiring share links, DigiLocker) ·
Client Portal (branded login, request lists, e-approval) · eSign (Aadhaar/DSC, bulk queue).

**Phase 5 — Intelligence**
Team timesheets + utilization · Practice analytics snapshots & cohort health ·
Copilot grounded on practice data (RAG over filings + documents) with notice-drafting.

**Cross-cutting:** real-time notifications (existing `NotificationQueue` + channels),
audit logging on every mutation, BullMQ for all batch ops, per-firm branding.
