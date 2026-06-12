// ============================================================
// lib/ca-hub/nav.ts
//
// Single source of truth for CA Hub navigation. Consumed by:
//   • components/ca-hub/CAHubSidebar.tsx  (rail nav)
//   • module landing pages                (feature grids)
//   • components/ca-hub/CAHubHeader.tsx    (breadcrumb resolution)
//
// Each module maps to a route group under app/(ca-hub)/ca-hub/<slug>.
// `status` drives the badge shown in the sidebar + landing pages:
//   live  → fully interactive
//   beta  → interactive, evolving
//   soon  → scaffolded, on the roadmap
//
// `items` feeds the landing-page feature grids; `subNav` feeds the
// sidebar accordion (module → sub-pages). Sub-pages flagged
// `comingSoon` render as disabled SOON rows — flip the flag once
// the route exists. CA_HUB_NAV_GROUPS at the bottom assembles the
// full sidebar tree consumed by <SidebarNavGroup>.
// ============================================================

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ReceiptText,
  Landmark,
  FileSpreadsheet,
  ClipboardCheck,
  Building2,
  FolderLock,
  MonitorSmartphone,
  PenLine,
  UsersRound,
  BarChart3,
  Sparkles,
  Briefcase,
} from "lucide-react";
import type { NavBadge, NavGroupConfig, NavItem } from "@/components/SidebarNavGroup";

export type ModuleStatus = "live" | "beta" | "soon";

export interface CaHubSubItem {
  label: string;
  href: string;
  /** Optional one-liner shown on the module landing feature grid. */
  blurb?: string;
}

/** Sidebar sub-page of a module (becomes a nested accordion row). */
export interface CaHubSubNavItem {
  label: string;
  href: string;
  /** no route yet — renders as a disabled SOON row */
  comingSoon?: boolean;
}

export interface CaHubModule {
  /** url slug under /ca-hub */
  slug: string;
  label: string;
  /** compact label used in the sidebar tree (falls back to `label`) */
  shortLabel?: string;
  /** sidebar grouping header */
  group: "Practice" | "Compliance" | "Filings" | "Assurance" | "Workspace" | "Intelligence";
  icon: LucideIcon;
  /** brand accent (hex) used for icons, rails, badges */
  accent: string;
  status: ModuleStatus;
  /** short description for landing hero + sidebar tooltip */
  description: string;
  /** sub-features (becomes the landing feature grid + future sub-routes) */
  items: CaHubSubItem[];
  /** sidebar sub-navigation — modules with subNav render as nested accordions */
  subNav?: CaHubSubNavItem[];
}

export const CA_HUB_BASE = "/ca-hub";

export const CA_HUB_MODULES: CaHubModule[] = [
  {
    slug: "",
    label: "Practice Dashboard",
    shortLabel: "Dashboard",
    group: "Practice",
    icon: LayoutDashboard,
    accent: "#6366f1",
    status: "live",
    description:
      "Multi-client command center — compliance load, revenue, and team productivity at a glance.",
    items: [
      { label: "Total Clients", href: "/ca-hub", blurb: "Active engagements across the firm" },
      { label: "GST / TDS / ITR / ROC Due", href: "/ca-hub", blurb: "Real-time obligation counters" },
      { label: "Audit Pending", href: "/ca-hub", blurb: "Engagements awaiting sign-off" },
      { label: "Revenue Analytics", href: "/ca-hub", blurb: "Billings, realization & WIP" },
      { label: "Team Productivity", href: "/ca-hub", blurb: "Utilization & throughput" },
    ],
  },
  {
    slug: "clients",
    label: "Client Portfolio",
    group: "Practice",
    icon: Users,
    accent: "#0ea5e9",
    status: "live",
    description:
      "Client 360 — compliance, banking, accounting, GST, TDS, ITR, payroll, audit, ROC & documents in one record.",
    items: [
      { label: "Client 360 View", href: "/ca-hub/clients", blurb: "Unified profile per client" },
      { label: "Compliance Status", href: "/ca-hub/clients", blurb: "Live health scorecard" },
      { label: "Banking & Accounting", href: "/ca-hub/clients", blurb: "Books + bank feeds" },
      { label: "GST / TDS / ITR", href: "/ca-hub/clients", blurb: "Tax obligations" },
      { label: "Payroll / Audit / ROC", href: "/ca-hub/clients", blurb: "Statutory coverage" },
      { label: "Documents", href: "/ca-hub/clients", blurb: "Client document vault" },
    ],
  },
  {
    slug: "compliance",
    label: "Compliance Center",
    group: "Compliance",
    icon: ShieldCheck,
    accent: "#10b981",
    status: "live",
    description:
      "Command center for every statutory due date with risk indicators and overdue tracking.",
    items: [
      { label: "Compliance Calendar", href: "/ca-hub/compliance", blurb: "Month + agenda views" },
      { label: "Due Dates", href: "/ca-hub/compliance", blurb: "Statutory deadline ledger" },
      { label: "Notifications", href: "/ca-hub/compliance", blurb: "Multi-channel reminders" },
      { label: "Risk Indicators", href: "/ca-hub/compliance", blurb: "Per-client risk scoring" },
      { label: "Overdue Tracking", href: "/ca-hub/compliance", blurb: "Escalation workflows" },
    ],
  },
  {
    slug: "gst",
    label: "GST Command Center",
    shortLabel: "GST",
    group: "Filings",
    icon: ReceiptText,
    accent: "#f59e0b",
    status: "beta",
    description:
      "End-to-end GST — GSTR-1/3B/9/9C, e-invoice, e-way bill, ITC reconciliation & bulk filing.",
    items: [
      { label: "GSTR-1", href: "/ca-hub/gst", blurb: "Outward supplies" },
      { label: "GSTR-3B", href: "/ca-hub/gst", blurb: "Monthly summary return" },
      { label: "GSTR-9 / 9C", href: "/ca-hub/gst", blurb: "Annual return + recon" },
      { label: "E-Invoice", href: "/ca-hub/gst", blurb: "IRN generation" },
      { label: "E-Way Bill", href: "/ca-hub/gst", blurb: "Movement of goods" },
      { label: "ITC Reconciliation", href: "/ca-hub/gst", blurb: "2B vs books matching" },
      { label: "Bulk Filing Workflows", href: "/ca-hub/gst", blurb: "Multi-GSTIN automation" },
    ],
    subNav: [
      { label: "Dashboard", href: "/ca-hub/gst" },
      { label: "Returns", href: "/ca-hub/gst/returns", comingSoon: true },
      { label: "Reconciliation", href: "/ca-hub/gst/reconciliation", comingSoon: true },
      { label: "Notices", href: "/ca-hub/gst/notices", comingSoon: true },
      { label: "AI Review", href: "/ca-hub/gst/ai-review", comingSoon: true },
    ],
  },
  {
    slug: "income-tax",
    label: "Income Tax Center",
    shortLabel: "Income Tax",
    group: "Filings",
    icon: FileSpreadsheet,
    accent: "#8b5cf6",
    status: "beta",
    description:
      "ITR 1–7 with AIS/TIS import, a tax computation engine, regime comparison & bulk filing.",
    items: [
      { label: "ITR 1–7", href: "/ca-hub/income-tax", blurb: "All return forms" },
      { label: "AIS / TIS Import", href: "/ca-hub/income-tax", blurb: "Annual info statement" },
      { label: "Tax Computation Engine", href: "/ca-hub/income-tax", blurb: "Slabs, surcharge, cess" },
      { label: "Regime Comparison", href: "/ca-hub/income-tax", blurb: "Old vs new optimizer" },
      { label: "Bulk Filing", href: "/ca-hub/income-tax", blurb: "Batch e-filing" },
    ],
    subNav: [
      { label: "Dashboard", href: "/ca-hub/income-tax" },
      { label: "Individual Returns", href: "/ca-hub/income-tax/individual-returns", comingSoon: true },
      { label: "Business Returns", href: "/ca-hub/income-tax/business-returns", comingSoon: true },
      { label: "Tax Planning", href: "/ca-hub/income-tax/tax-planning", comingSoon: true },
      { label: "Notices", href: "/ca-hub/income-tax/notices", comingSoon: true },
    ],
  },
  {
    slug: "tds",
    label: "TDS Center",
    shortLabel: "TDS",
    group: "Filings",
    icon: Landmark,
    accent: "#06b6d4",
    status: "beta",
    description:
      "24Q / 26Q / 27Q / 27EQ, Form 16 & 16A, TRACES integration and challan reconciliation.",
    items: [
      { label: "Form 24Q", href: "/ca-hub/tds", blurb: "Salary TDS" },
      { label: "Form 26Q", href: "/ca-hub/tds", blurb: "Non-salary TDS" },
      { label: "Form 27Q / 27EQ", href: "/ca-hub/tds", blurb: "NRI + TCS" },
      { label: "Form 16 / 16A", href: "/ca-hub/tds", blurb: "Certificate generation" },
      { label: "TRACES Integration", href: "/ca-hub/tds", blurb: "Justification + defaults" },
      { label: "Challan Reconciliation", href: "/ca-hub/tds", blurb: "OLTAS matching" },
    ],
    subNav: [
      { label: "Dashboard", href: "/ca-hub/tds" },
      { label: "Returns", href: "/ca-hub/tds/returns", comingSoon: true },
      { label: "Certificates", href: "/ca-hub/tds/certificates", comingSoon: true },
      { label: "Compliance", href: "/ca-hub/tds/compliance", comingSoon: true },
    ],
  },
  {
    slug: "audit",
    label: "Audit Workspace",
    shortLabel: "Audit",
    group: "Assurance",
    icon: ClipboardCheck,
    accent: "#ec4899",
    status: "beta",
    description:
      "Workpapers, sampling, audit planning, CARO 2020, tax audit 3CA/3CB/3CD & UDIN automation.",
    items: [
      { label: "Workpapers", href: "/ca-hub/audit", blurb: "Indexed working papers" },
      { label: "Sampling", href: "/ca-hub/audit", blurb: "Statistical + judgmental" },
      { label: "Audit Planning", href: "/ca-hub/audit", blurb: "Risk-based programs" },
      { label: "CARO 2020", href: "/ca-hub/audit", blurb: "Clause-wise reporting" },
      { label: "Tax Audit 3CA/3CB/3CD", href: "/ca-hub/audit", blurb: "Form generation" },
      { label: "UDIN Automation", href: "/ca-hub/audit", blurb: "ICAI UDIN minting" },
    ],
    subNav: [
      { label: "Dashboard", href: "/ca-hub/audit" },
      { label: "Engagements", href: "/ca-hub/audit/engagements", comingSoon: true },
      { label: "Working Papers", href: "/ca-hub/audit/working-papers", comingSoon: true },
      { label: "Findings", href: "/ca-hub/audit/findings", comingSoon: true },
      { label: "Reports", href: "/ca-hub/audit/reports", comingSoon: true },
    ],
  },
  {
    slug: "roc",
    label: "ROC & MCA Center",
    shortLabel: "ROC & MCA",
    group: "Assurance",
    icon: Building2,
    accent: "#f43f5e",
    status: "soon",
    description:
      "AOC-4, MGT-7, DIR-3 KYC, LLP forms and a unified MCA filing tracker.",
    items: [
      { label: "AOC-4", href: "/ca-hub/roc", blurb: "Financial statements" },
      { label: "MGT-7 / 7A", href: "/ca-hub/roc", blurb: "Annual return" },
      { label: "DIR-3 KYC", href: "/ca-hub/roc", blurb: "Director KYC" },
      { label: "LLP Forms", href: "/ca-hub/roc", blurb: "Form 8 + Form 11" },
      { label: "Filing Tracker", href: "/ca-hub/roc", blurb: "SRN + status timeline" },
    ],
    subNav: [
      { label: "Dashboard", href: "/ca-hub/roc" },
      { label: "Incorporation", href: "/ca-hub/roc/incorporation", comingSoon: true },
      { label: "Annual Filings", href: "/ca-hub/roc/annual-filings", comingSoon: true },
      { label: "Compliance", href: "/ca-hub/roc/compliance", comingSoon: true },
      { label: "Forms", href: "/ca-hub/roc/forms", comingSoon: true },
    ],
  },
  {
    slug: "documents",
    label: "Document Vault",
    shortLabel: "Documents",
    group: "Workspace",
    icon: FolderLock,
    accent: "#14b8a6",
    status: "beta",
    description:
      "OCR search, versioning, secure sharing and DigiLocker integration.",
    items: [
      { label: "OCR Search", href: "/ca-hub/documents", blurb: "Full-text across scans" },
      { label: "Versioning", href: "/ca-hub/documents", blurb: "Immutable history" },
      { label: "Secure Sharing", href: "/ca-hub/documents", blurb: "Expiring links + audit" },
      { label: "DigiLocker", href: "/ca-hub/documents", blurb: "Govt document pull" },
    ],
    subNav: [
      { label: "Document Vault", href: "/ca-hub/documents" },
      { label: "Shared Documents", href: "/ca-hub/documents/shared", comingSoon: true },
      { label: "Client Requests", href: "/ca-hub/documents/requests", comingSoon: true },
    ],
  },
  {
    slug: "client-portal",
    label: "Client Portal",
    group: "Workspace",
    icon: MonitorSmartphone,
    accent: "#3b82f6",
    status: "beta",
    description:
      "Branded client login for document upload, filing approval and a messaging center.",
    items: [
      { label: "Client Login", href: "/ca-hub/client-portal", blurb: "Branded SSO access" },
      { label: "Document Upload", href: "/ca-hub/client-portal", blurb: "Request + collect" },
      { label: "Filing Approval", href: "/ca-hub/client-portal", blurb: "e-Approve returns" },
      { label: "Messaging Center", href: "/ca-hub/client-portal", blurb: "Threaded comms" },
    ],
    subNav: [
      { label: "Portal Home", href: "/ca-hub/client-portal" },
      // client workspace launchers — these live in the CA Portal shell
      { label: "All Clients", href: "/ca/customers/all" },
      { label: "Assigned Clients", href: "/ca/customers/assigned" },
      { label: "Activities", href: "/ca/customers/activity" },
      { label: "Records", href: "/ca/customers" },
    ],
  },
  {
    slug: "esign",
    label: "eSign Center",
    shortLabel: "eSign",
    group: "Workspace",
    icon: PenLine,
    accent: "#a855f7",
    status: "soon",
    description:
      "Aadhaar eSign, DSC signing and a bulk signing queue.",
    items: [
      { label: "Aadhaar eSign", href: "/ca-hub/esign", blurb: "OTP-based signing" },
      { label: "DSC Signing", href: "/ca-hub/esign", blurb: "Token + cloud DSC" },
      { label: "Bulk Signing Queue", href: "/ca-hub/esign", blurb: "Batch sign-off" },
    ],
    subNav: [
      { label: "Dashboard", href: "/ca-hub/esign" },
      { label: "Pending", href: "/ca-hub/esign/pending", comingSoon: true },
      { label: "Completed", href: "/ca-hub/esign/completed", comingSoon: true },
      { label: "Templates", href: "/ca-hub/esign/templates", comingSoon: true },
    ],
  },
  {
    slug: "team",
    label: "Team Management",
    group: "Practice",
    icon: UsersRound,
    accent: "#22c55e",
    status: "beta",
    description:
      "Roles, task allocation, timesheets and productivity analytics.",
    items: [
      { label: "Roles", href: "/ca-hub/team", blurb: "RBAC + delegation" },
      { label: "Tasks", href: "/ca-hub/team", blurb: "Assignment + SLAs" },
      { label: "Timesheets", href: "/ca-hub/team", blurb: "Billable hours" },
      { label: "Productivity", href: "/ca-hub/team", blurb: "Utilization metrics" },
    ],
  },
  {
    slug: "analytics",
    label: "Practice Analytics",
    group: "Practice",
    icon: BarChart3,
    accent: "#eab308",
    status: "beta",
    description:
      "Revenue, compliance, team performance and client health scores.",
    items: [
      { label: "Revenue", href: "/ca-hub/analytics", blurb: "Billings + realization" },
      { label: "Compliance", href: "/ca-hub/analytics", blurb: "On-time filing rate" },
      { label: "Team Performance", href: "/ca-hub/analytics", blurb: "Throughput leaderboard" },
      { label: "Client Health Scores", href: "/ca-hub/analytics", blurb: "Churn + risk signals" },
    ],
  },
  {
    slug: "copilot",
    label: "AI CA Copilot",
    shortLabel: "AI Copilot",
    group: "Intelligence",
    icon: Sparkles,
    accent: "#f97316",
    status: "beta",
    description:
      "Compliance, audit, GST, tax and notice-response assistants powered by Gemini.",
    items: [
      { label: "Compliance Assistant", href: "/ca-hub/copilot", blurb: "Due-date + rule lookup" },
      { label: "Audit Assistant", href: "/ca-hub/copilot", blurb: "Workpaper drafting" },
      { label: "GST Assistant", href: "/ca-hub/copilot", blurb: "Rate + ITC queries" },
      { label: "Tax Assistant", href: "/ca-hub/copilot", blurb: "Computation help" },
      { label: "Notice Response", href: "/ca-hub/copilot", blurb: "Draft replies to notices" },
    ],
    subNav: [
      { label: "Dashboard", href: "/ca-hub/copilot" },
      { label: "Compliance Assistant", href: "/ca-hub/copilot/compliance", comingSoon: true },
      { label: "GST Assistant", href: "/ca-hub/copilot/gst", comingSoon: true },
      { label: "Tax Assistant", href: "/ca-hub/copilot/tax", comingSoon: true },
      { label: "Audit Assistant", href: "/ca-hub/copilot/audit", comingSoon: true },
    ],
  },
];

/** Sidebar grouping order. */
export const CA_HUB_GROUPS: CaHubModule["group"][] = [
  "Practice",
  "Compliance",
  "Filings",
  "Assurance",
  "Workspace",
  "Intelligence",
];

export function getModuleBySlug(slug: string): CaHubModule | undefined {
  return CA_HUB_MODULES.find((m) => m.slug === slug);
}

export function moduleHref(m: CaHubModule): string {
  return m.slug ? `${CA_HUB_BASE}/${m.slug}` : CA_HUB_BASE;
}

// ── Sidebar tree assembly ─────────────────────────────────────

/** Status → sidebar badge (live modules show no badge). */
export const STATUS_BADGE: Record<ModuleStatus, NavBadge | null> = {
  live: null,
  beta: { text: "BETA", color: "#818cf8", background: "rgba(99,102,241,0.16)" },
  soon: { text: "SOON", color: "#a1a1aa", background: "rgba(161,161,170,0.14)" },
};

const GROUP_ICONS: Record<CaHubModule["group"], LucideIcon> = {
  Practice: Briefcase,
  Compliance: ShieldCheck,
  Filings: ReceiptText,
  Assurance: ClipboardCheck,
  Workspace: FolderLock,
  Intelligence: Sparkles,
};

function moduleToNavItem(m: CaHubModule): NavItem {
  const base = moduleHref(m);
  const badge = STATUS_BADGE[m.status] ?? undefined;
  const label = m.shortLabel ?? m.label;

  // modules without subNav are plain leaves
  if (!m.subNav) {
    return {
      label,
      href: base,
      icon: m.icon,
      accent: m.accent,
      badge,
      description: m.description,
      exact: m.slug === "",
    };
  }

  // modules with subNav render as nested accordions
  return {
    id: m.slug || "dashboard",
    label,
    icon: m.icon,
    accent: m.accent,
    badge,
    description: m.description,
    basePath: base,
    items: m.subNav.map((s) => ({
      label: s.label,
      href: s.href,
      comingSoon: s.comingSoon,
      exact: s.href === base,
    })),
  };
}

/** Full sidebar tree: domain group → module → sub-pages. */
export const CA_HUB_NAV_GROUPS: NavGroupConfig[] = CA_HUB_GROUPS.map((group) => ({
  id: group.toLowerCase(),
  label: group,
  icon: GROUP_ICONS[group],
  items: CA_HUB_MODULES.filter((m) => m.group === group).map(moduleToNavItem),
}));
