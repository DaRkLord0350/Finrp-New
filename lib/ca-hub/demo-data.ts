// ============================================================
// lib/ca-hub/demo-data.ts
//
// Representative practice data powering the CA Hub UI. This keeps the
// module fully navigable & visually complete without depending on the
// CA Hub migration having run yet.
//
// ── Wiring real data ───────────────────────────────────────
// Each export below maps 1:1 to a Prisma query once the ca_hub_*
// tables are migrated (see prisma/schema.prisma → "CA HUB" section
// and CA_HUB_ARCHITECTURE.md → "API architecture"). Example:
//
//   export async function getPracticeKpis(orgId: string) {
//     const [clients, gstDue, ...] = await prisma.$transaction([...]);
//     return { ... };
//   }
//
// The shapes here are the contracts those queries must satisfy.
// ============================================================

export type FilingState =
  | "FILED"
  | "READY"
  | "IN_PROGRESS"
  | "PENDING"
  | "OVERDUE"
  | "NA";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface DemoClient {
  id: string;
  name: string;
  type: "Pvt Ltd" | "LLP" | "Proprietorship" | "Partnership" | "Individual";
  gstin: string | null;
  pan: string;
  healthScore: number;
  risk: RiskLevel;
  partner: string;
  manager: string;
  openTasks: number;
  monthlyFee: number;
  compliance: {
    gst: FilingState;
    tds: FilingState;
    itr: FilingState;
    roc: FilingState;
    audit: FilingState;
    payroll: FilingState;
  };
  nextDue: { label: string; date: string; days: number };
}

export interface DemoDeadline {
  id: string;
  client: string;
  obligation: string;
  category: "GST" | "TDS" | "Income Tax" | "ROC" | "Audit" | "PF/ESI";
  dueDate: string;
  daysLeft: number;
  status: FilingState;
  assignee: string;
}

// ── Money formatting (Indian system) ───────────────────────
export function formatINR(n: number): string {
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toFixed(0)}`;
}

export function formatINRFull(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

// ── Practice KPIs (dashboard hero) ─────────────────────────
export const practiceKpis = {
  totalClients: 184,
  activeClients: 171,
  gstDue: 47,
  tdsDue: 23,
  itrDue: 61,
  rocDue: 12,
  auditPending: 9,
  revenueMTD: 2840000,
  revenueYTD: 28650000,
  revenueGrowth: 14.2,
  wip: 4120000,
  realizationRate: 87.4,
  onTimeFilingRate: 96.1,
  teamUtilization: 82.5,
  overdue: 6,
};

// ── Revenue trend (12 months) ──────────────────────────────
export const revenueTrend = [
  { month: "Jul", billed: 1980000, collected: 1820000 },
  { month: "Aug", billed: 2120000, collected: 1990000 },
  { month: "Sep", billed: 2460000, collected: 2210000 },
  { month: "Oct", billed: 2310000, collected: 2280000 },
  { month: "Nov", billed: 2680000, collected: 2410000 },
  { month: "Dec", billed: 2540000, collected: 2490000 },
  { month: "Jan", billed: 2890000, collected: 2620000 },
  { month: "Feb", billed: 2730000, collected: 2700000 },
  { month: "Mar", billed: 3410000, collected: 3120000 },
  { month: "Apr", billed: 2210000, collected: 2180000 },
  { month: "May", billed: 2620000, collected: 2440000 },
  { month: "Jun", billed: 2840000, collected: 2510000 },
];

// ── Compliance load by category (stacked) ──────────────────
export const complianceLoad = [
  { category: "GST", filed: 312, pending: 47, overdue: 4 },
  { category: "TDS", filed: 198, pending: 23, overdue: 2 },
  { category: "ITR", filed: 88, pending: 61, overdue: 0 },
  { category: "ROC", filed: 64, pending: 12, overdue: 1 },
  { category: "Audit", filed: 31, pending: 9, overdue: 0 },
];

// ── Filing status distribution (donut) ─────────────────────
export const filingStatusMix = [
  { name: "Filed", value: 693, color: "#10b981" },
  { name: "Ready to File", value: 58, color: "#06b6d4" },
  { name: "In Progress", value: 96, color: "#6366f1" },
  { name: "Pending Docs", value: 81, color: "#f59e0b" },
  { name: "Overdue", value: 6, color: "#ef4444" },
];

// ── Team productivity ──────────────────────────────────────
export const teamProductivity = [
  { name: "CA Anjali Mehta", role: "Partner", clients: 38, completed: 142, utilization: 91, billable: 168 },
  { name: "CA Rohit Sharma", role: "Manager", clients: 44, completed: 168, utilization: 88, billable: 176 },
  { name: "CA Sneha Iyer", role: "Manager", clients: 36, completed: 121, utilization: 84, billable: 159 },
  { name: "Karan Patel", role: "Article", clients: 29, completed: 97, utilization: 79, billable: 184 },
  { name: "Divya Nair", role: "Article", clients: 22, completed: 84, utilization: 76, billable: 191 },
  { name: "Aman Gupta", role: "Semi-Qualified", clients: 31, completed: 103, utilization: 81, billable: 172 },
];

// ── Clients (portfolio) ────────────────────────────────────
export const demoClients: DemoClient[] = [
  {
    id: "cl_acme", name: "Acme Industries Pvt Ltd", type: "Pvt Ltd",
    gstin: "27AABCA1234F1Z5", pan: "AABCA1234F", healthScore: 92, risk: "LOW",
    partner: "CA Anjali Mehta", manager: "CA Rohit Sharma", openTasks: 3, monthlyFee: 45000,
    compliance: { gst: "FILED", tds: "READY", itr: "IN_PROGRESS", roc: "FILED", audit: "IN_PROGRESS", payroll: "FILED" },
    nextDue: { label: "GSTR-3B (Jun)", date: "2026-06-20", days: 9 },
  },
  {
    id: "cl_zenith", name: "Zenith Textiles LLP", type: "LLP",
    gstin: "24AAJFZ5678K1Z2", pan: "AAJFZ5678K", healthScore: 78, risk: "MEDIUM",
    partner: "CA Anjali Mehta", manager: "CA Sneha Iyer", openTasks: 6, monthlyFee: 32000,
    compliance: { gst: "PENDING", tds: "FILED", itr: "PENDING", roc: "OVERDUE", audit: "PENDING", payroll: "FILED" },
    nextDue: { label: "LLP Form 11", date: "2026-05-30", days: -12 },
  },
  {
    id: "cl_nova", name: "Nova Pharma Pvt Ltd", type: "Pvt Ltd",
    gstin: "29AABCN9012M1Z8", pan: "AABCN9012M", healthScore: 88, risk: "LOW",
    partner: "CA Rohit Sharma", manager: "CA Sneha Iyer", openTasks: 2, monthlyFee: 68000,
    compliance: { gst: "FILED", tds: "FILED", itr: "READY", roc: "IN_PROGRESS", audit: "IN_PROGRESS", payroll: "FILED" },
    nextDue: { label: "Tax Audit 3CD", date: "2026-09-30", days: 111 },
  },
  {
    id: "cl_orbit", name: "Orbit Logistics", type: "Partnership",
    gstin: "07AAGFO3456P1Z1", pan: "AAGFO3456P", healthScore: 64, risk: "HIGH",
    partner: "CA Sneha Iyer", manager: "Karan Patel", openTasks: 9, monthlyFee: 28000,
    compliance: { gst: "OVERDUE", tds: "PENDING", itr: "PENDING", roc: "NA", audit: "PENDING", payroll: "PENDING" },
    nextDue: { label: "GSTR-1 (May)", date: "2026-06-11", days: 0 },
  },
  {
    id: "cl_lumen", name: "Lumen Software Pvt Ltd", type: "Pvt Ltd",
    gstin: "27AABCL7890Q1Z3", pan: "AABCL7890Q", healthScore: 95, risk: "LOW",
    partner: "CA Anjali Mehta", manager: "CA Rohit Sharma", openTasks: 1, monthlyFee: 85000,
    compliance: { gst: "FILED", tds: "FILED", itr: "FILED", roc: "FILED", audit: "READY", payroll: "FILED" },
    nextDue: { label: "GSTR-3B (Jun)", date: "2026-06-20", days: 9 },
  },
  {
    id: "cl_vertex", name: "Vertex Realty LLP", type: "LLP",
    gstin: "27AAKFV2345R1Z9", pan: "AAKFV2345R", healthScore: 71, risk: "MEDIUM",
    partner: "CA Rohit Sharma", manager: "Divya Nair", openTasks: 5, monthlyFee: 39000,
    compliance: { gst: "IN_PROGRESS", tds: "READY", itr: "PENDING", roc: "PENDING", audit: "PENDING", payroll: "READY" },
    nextDue: { label: "TDS 26Q (Q1)", date: "2026-07-31", days: 50 },
  },
  {
    id: "cl_sunrise", name: "Sunrise Foods Pvt Ltd", type: "Pvt Ltd",
    gstin: "33AABCS6789S1Z4", pan: "AABCS6789S", healthScore: 83, risk: "LOW",
    partner: "CA Sneha Iyer", manager: "Aman Gupta", openTasks: 4, monthlyFee: 52000,
    compliance: { gst: "FILED", tds: "IN_PROGRESS", itr: "PENDING", roc: "IN_PROGRESS", audit: "PENDING", payroll: "FILED" },
    nextDue: { label: "GSTR-3B (Jun)", date: "2026-06-20", days: 9 },
  },
  {
    id: "cl_kiran", name: "Kiran Patel (Individual)", type: "Individual",
    gstin: null, pan: "BKPPP4567L", healthScore: 90, risk: "LOW",
    partner: "CA Anjali Mehta", manager: "Karan Patel", openTasks: 1, monthlyFee: 12000,
    compliance: { gst: "NA", tds: "NA", itr: "IN_PROGRESS", roc: "NA", audit: "NA", payroll: "NA" },
    nextDue: { label: "ITR-2 (AY 26-27)", date: "2026-07-31", days: 50 },
  },
];

// ── Upcoming deadlines (compliance calendar / dashboard) ───
export const demoDeadlines: DemoDeadline[] = [
  { id: "d1", client: "Orbit Logistics", obligation: "GSTR-1 (May 2026)", category: "GST", dueDate: "2026-06-11", daysLeft: 0, status: "OVERDUE", assignee: "Karan Patel" },
  { id: "d2", client: "Zenith Textiles LLP", obligation: "LLP Form 11", category: "ROC", dueDate: "2026-05-30", daysLeft: -12, status: "OVERDUE", assignee: "CA Sneha Iyer" },
  { id: "d3", client: "Acme Industries", obligation: "GSTR-3B (Jun 2026)", category: "GST", dueDate: "2026-06-20", daysLeft: 9, status: "IN_PROGRESS", assignee: "CA Rohit Sharma" },
  { id: "d4", client: "Lumen Software", obligation: "GSTR-3B (Jun 2026)", category: "GST", dueDate: "2026-06-20", daysLeft: 9, status: "READY", assignee: "CA Rohit Sharma" },
  { id: "d5", client: "Sunrise Foods", obligation: "PF & ESI Challan", category: "PF/ESI", dueDate: "2026-06-15", daysLeft: 4, status: "PENDING", assignee: "Aman Gupta" },
  { id: "d6", client: "Vertex Realty LLP", obligation: "TDS 26Q (Q1 FY26-27)", category: "TDS", dueDate: "2026-07-31", daysLeft: 50, status: "READY", assignee: "Divya Nair" },
  { id: "d7", client: "Nova Pharma", obligation: "Tax Audit 3CD", category: "Audit", dueDate: "2026-09-30", daysLeft: 111, status: "IN_PROGRESS", assignee: "CA Sneha Iyer" },
  { id: "d8", client: "Kiran Patel", obligation: "ITR-2 (AY 2026-27)", category: "Income Tax", dueDate: "2026-07-31", daysLeft: 50, status: "IN_PROGRESS", assignee: "Karan Patel" },
];

// ── GST Command Center ─────────────────────────────────────
export const gstReturnTiles = [
  { code: "GSTR-1", label: "Outward Supplies", filed: 142, pending: 22, due: "11 Jun", accent: "#f59e0b" },
  { code: "GSTR-3B", label: "Monthly Summary", filed: 138, pending: 25, due: "20 Jun", accent: "#6366f1" },
  { code: "GSTR-9", label: "Annual Return", filed: 19, pending: 6, due: "31 Dec", accent: "#10b981" },
  { code: "GSTR-9C", label: "Reconciliation", filed: 11, pending: 3, due: "31 Dec", accent: "#06b6d4" },
];

export const gstFilingQueue = [
  { client: "Acme Industries", gstin: "27AABCA1234F1Z5", return: "GSTR-3B", period: "May 2026", taxable: 4820000, liability: 868000, itc: 612000, status: "READY" as FilingState },
  { client: "Orbit Logistics", gstin: "07AAGFO3456P1Z1", return: "GSTR-1", period: "May 2026", taxable: 1240000, liability: 223200, itc: 0, status: "OVERDUE" as FilingState },
  { client: "Nova Pharma", gstin: "29AABCN9012M1Z8", return: "GSTR-3B", period: "May 2026", taxable: 9650000, liability: 1737000, itc: 1320000, status: "FILED" as FilingState },
  { client: "Sunrise Foods", gstin: "33AABCS6789S1Z4", return: "GSTR-1", period: "May 2026", taxable: 3110000, liability: 155500, itc: 0, status: "IN_PROGRESS" as FilingState },
  { client: "Vertex Realty", gstin: "27AAKFV2345R1Z9", return: "GSTR-3B", period: "May 2026", taxable: 2240000, liability: 403200, itc: 288000, status: "PENDING" as FilingState },
];

export const itcReconSummary = { matched: 612, partial: 38, mismatch: 14, missingIn2B: 9, missingInBooks: 21 };

// ── AI Copilot seed conversation ───────────────────────────
export const copilotSuggestions = [
  { domain: "Compliance", q: "Which clients have GST returns due in the next 7 days?" },
  { domain: "GST", q: "Explain ITC eligibility for capital goods under Rule 43." },
  { domain: "Tax", q: "Compare old vs new regime for ₹18L salary with 80C maxed." },
  { domain: "Audit", q: "Draft a CARO 2020 clause (iii) observation for inter-corporate loans." },
  { domain: "Notice", q: "Draft a response to a Section 143(1)(a) intimation mismatch." },
];

// ── Status visual tokens ───────────────────────────────────
export const FILING_TOKENS: Record<FilingState, { label: string; color: string; bg: string }> = {
  FILED:       { label: "Filed",       color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  READY:       { label: "Ready",       color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  IN_PROGRESS: { label: "In Progress", color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  PENDING:     { label: "Pending",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  OVERDUE:     { label: "Overdue",     color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  NA:          { label: "N/A",         color: "#71717a", bg: "rgba(113,113,122,0.10)" },
};

export const RISK_TOKENS: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  LOW:    { label: "Low Risk",    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  MEDIUM: { label: "Medium Risk", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  HIGH:   { label: "High Risk",   color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};
