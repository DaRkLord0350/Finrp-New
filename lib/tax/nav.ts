// ============================================================
// lib/tax/nav.ts
//
// Navigation config for the Tax & Compliance Engine route group.
// GST is live in this phase; the remaining modules are listed as
// "coming soon" so the IA is visible and the roadmap is discoverable.
// ============================================================

export interface TaxNavItem {
  label: string;
  href: string;
  icon: string; // lucide-react icon name
  status: "live" | "soon";
  badge?: string;
}

export interface TaxNavSection {
  title: string;
  items: TaxNavItem[];
}

export const TAX_NAV: TaxNavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/tax", icon: "LayoutDashboard", status: "live" },
    ],
  },
  {
    title: "GST",
    items: [
      { label: "GST Dashboard", href: "/tax/gst", icon: "ReceiptText", status: "live" },
      { label: "Invoices", href: "/tax/gst/invoices", icon: "FileText", status: "live" },
      { label: "GSTR-1", href: "/tax/gst/gstr1", icon: "FileCheck2", status: "live" },
      { label: "GSTR-3B", href: "/tax/gst/gstr3b", icon: "Calculator", status: "live" },
      { label: "2B Reconciliation", href: "/tax/gst/reconcile", icon: "GitCompareArrows", status: "live" },
      { label: "Filing", href: "/tax/gst/filing", icon: "Send", status: "live" },
    ],
  },
  {
    title: "Direct Tax",
    items: [
      { label: "TDS", href: "/tax/tds", icon: "Landmark", status: "live" },
      { label: "Income Tax", href: "/tax/income-tax", icon: "Coins", status: "live" },
      { label: "Capital Gains", href: "/tax/capital-gains", icon: "TrendingUp", status: "live" },
    ],
  },
  {
    title: "Accounts & Audit",
    items: [
      { label: "Trial Balance", href: "/tax/trial-balance", icon: "Scale", status: "live" },
      { label: "Financial Statements", href: "/tax/financials", icon: "BookOpen", status: "live" },
      { label: "Audit Reports", href: "/tax/audit", icon: "ShieldCheck", status: "live" },
    ],
  },
  {
    title: "Engine",
    items: [
      { label: "Admin", href: "/tax/admin", icon: "Gauge", status: "live" },
      { label: "Config Versions", href: "/tax/admin/config", icon: "Settings2", status: "live" },
    ],
  },
];
