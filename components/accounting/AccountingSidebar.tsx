"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  BookText,
  BookOpen,
  Scale,
  Landmark,
  TrendingUp,
  Droplets,
  PiggyBank,
  Globe,
  CalendarRange,
  Lock,
  Replace,
  Upload,
  History,
  ChevronRight,
  FileBarChart,
  Brain,
  FileText,
  Sliders,
  ShieldCheck,
  Sparkles,
  BarChart2,
  Layers,
  Download,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  exact?: boolean;
};

// Grown phase-by-phase as each module's pages land (avoids dead links).
const accountingNav: NavItem[] = [
  { label: "Overview",          href: "/accounting",                  icon: LayoutDashboard, exact: true },
  { label: "Chart of Accounts", href: "/accounting/chart-of-accounts", icon: Wallet },
  { label: "Manual Journals",   href: "/accounting/journals",         icon: BookText },
  { label: "General Ledger",    href: "/accounting/general-ledger",   icon: BookOpen },
  { label: "Trial Balance",     href: "/accounting/trial-balance",    icon: Scale },
  { label: "Balance Sheet",     href: "/accounting/balance-sheet",    icon: Landmark },
  { label: "Profit & Loss",     href: "/accounting/profit-loss",      icon: TrendingUp },
  { label: "Cash Flow",         href: "/accounting/cash-flow",        icon: Droplets },
  { label: "Budgets",           href: "/accounting/budgets",          icon: PiggyBank },
  { label: "Currency",          href: "/accounting/currency",         icon: Globe },
  { label: "Fiscal Years",      href: "/accounting/fiscal-years",     icon: CalendarRange },
  { label: "Period Locking",    href: "/accounting/period-locking",   icon: Lock },
  { label: "Bulk Update",       href: "/accounting/bulk-update",      icon: Replace },
  { label: "Post to Ledger",    href: "/accounting/posting",          icon: Upload },
  { label: "Audit Trail",       href: "/accounting/audit-trail",      icon: History },
];

const financialStatementsNav: NavItem[] = [
  { label: "Financial Statements", href: "/accounting/financial-statements", icon: FileBarChart, exact: true },
  { label: "AI Ledger Mapping",    href: "/accounting/financial-statements/ledger-mapping", icon: Brain },
  { label: "Schedule III BS",      href: "/accounting/financial-statements/balance-sheet",  icon: Landmark },
  { label: "Profit & Loss",        href: "/accounting/financial-statements/profit-loss",    icon: TrendingUp },
  { label: "Cash Flow",            href: "/accounting/financial-statements/cash-flow",      icon: Droplets },
  { label: "Notes & Policies",     href: "/accounting/financial-statements/notes",          icon: FileText },
  { label: "Adjustments",          href: "/accounting/financial-statements/adjustments",    icon: Sliders },
  { label: "Validation Center",    href: "/accounting/financial-statements/validation",     icon: ShieldCheck },
  { label: "AI Review",            href: "/accounting/financial-statements/ai-review",      icon: Sparkles },
  { label: "Comparative Years",    href: "/accounting/financial-statements/comparative",    icon: BarChart2 },
  { label: "Consolidation",        href: "/accounting/financial-statements/consolidation",  icon: Layers },
  { label: "Export Center",        href: "/accounting/financial-statements/export",         icon: Download },
  { label: "Version History",      href: "/accounting/financial-statements/versions",       icon: GitBranch },
];

function NavGroup({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <>
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("sidebar-nav-item", isActive && "active")}
            style={{ fontSize: 13, padding: "8px 10px" }}
          >
            <Icon size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && (
              <span style={{
                fontSize: 9, fontWeight: 700,
                background: "rgba(99,102,241,0.15)",
                color: "#818cf8",
                padding: "1px 5px",
                borderRadius: 4,
                letterSpacing: "0.04em",
              }}>
                {item.badge}
              </span>
            )}
            {isActive && !item.badge && <ChevronRight size={10} style={{ opacity: 0.5 }} />}
          </Link>
        );
      })}
    </>
  );
}

export default function AccountingSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 8px",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "0 8px 12px", borderBottom: "1px solid var(--border)" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Accounting
        </p>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
          Double-entry ledger
        </p>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, marginTop: 12 }}>
        <NavGroup items={accountingNav} pathname={pathname} />

        {/* Financial Statements section divider */}
        <div style={{ margin: "14px 0 6px", padding: "0 8px" }}>
          <div style={{ borderTop: "1px solid var(--border)", marginBottom: 10 }} />
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", margin: 0 }}>
            Financial Statements
          </p>
        </div>

        <NavGroup items={financialStatementsNav} pathname={pathname} />
      </nav>
    </aside>
  );
}
