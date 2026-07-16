"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  ShieldCheck,
  Bot,
  Settings,
  Boxes,
  Zap,
  ChevronRight,
  X,
  Landmark,
  Scale,
  Wallet,
  Plug,
  BarChart2,
  Building2,
  Receipt,
  Sparkles,
  FilePlus2,
  Lock,
  CreditCard,
  HandCoins,
  FileSignature,
  AlertTriangle,
  ClipboardList,
  ShieldAlert,
  ListChecks,
  ShieldX,
  BadgeCheck,
  Radar,
  FolderKanban,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNavGroup, type NavGroupConfig } from "@/components/SidebarNavGroup";
import { hasModuleAccessFromList, type AppModule } from "@/lib/auth/rbac";
import { FEATURES } from "@/lib/billing/features";
import { useEntitlements } from "@/components/billing/EntitlementsProvider";

// ── Sidebar group configuration ───────────────────────────────
// Every major module is a collapsible group rendered by the
// shared <SidebarNavGroup>. Add new modules by appending a config
// object here — no new component logic needed.

const navGroups: NavGroupConfig[] = [
  {
    id: "dashboard",
    section: "Main Menu",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { label: "Overview",   href: "/dashboard",  icon: LayoutDashboard, module: "dashboard" },
      { label: "CRM",        href: "/crm",        icon: Users, module: "crm" },
      { label: "Finance",    href: "/finance",    icon: BarChart3, module: "finance" },
      { label: "Accounting", href: "/accounting", icon: Wallet, activePrefix: "/accounting", module: "accounting" },
      { label: "ERP",        href: "/erp",        icon: Boxes, module: "erp" },
      { label: "Compliance", href: "/compliance", icon: ShieldCheck, module: "compliance" },
      { label: "Reports",    href: "/reports",    icon: BarChart2, module: "reports" },
    ],
  },
  {
    id: "billing",
    section: "Billing",
    label: "Billing",
    icon: Receipt,
    module: "billing",
    basePath: "/billing",
    items: [
      { label: "Invoices",         href: "/billing",       icon: FileText, exact: true, module: "billing" },
      { label: "New Invoice",      href: "/billing/new",    icon: FilePlus2, module: "billing" },
      { label: "Items & Services", href: "/billing/items",  icon: Boxes, module: "inventory" },
    ],
  },
  {
    id: "banking",
    section: "Banking",
    label: "Banking OS",
    icon: Landmark,
    badge: { text: "NEW", background: "rgba(99,102,241,0.15)", color: "#818cf8" },
    basePath: "/banking",
    items: [
      { label: "Dashboard",      href: "/banking/dashboard",      icon: LayoutDashboard },
      { label: "Bank Accounts",  href: "/banking/accounts",       icon: Building2 },
      { label: "Payments",       href: "/banking/payments",       icon: CreditCard },
      { label: "Transactions",   href: "/banking/transactions",   icon: Wallet },
      { label: "Reconciliation", href: "/banking/reconciliation", icon: Scale },
      { label: "Cash Flow",      href: "/banking/cash-flow",      icon: BarChart3 },
      { label: "GST Match",      href: "/banking/gst-match",      icon: ShieldCheck },
      { label: "AI Insights",    href: "/banking/ai-insights",    icon: Bot, feature: FEATURES.AI },
    ],
    footer: { label: "View all →", href: "/banking" },
  },
  {
    id: "lending",
    section: "Lending",
    label: "Lending",
    icon: HandCoins,
    module: "lending",
    badge: { text: "NEW", background: "rgba(99,102,241,0.15)", color: "#818cf8" },
    basePath: "/lending",
    items: [
      { label: "Portfolio",     href: "/lending",              icon: LayoutDashboard, exact: true, module: "lending" },
      { label: "Applications",  href: "/lending/applications", icon: ClipboardList, module: "lending" },
      { label: "New Application", href: "/lending/applications/new", icon: FilePlus2, module: "lending" },
      { label: "Loan Accounts", href: "/lending/accounts",     icon: HandCoins, module: "lending" },
      { label: "Credit Reports", href: "/lending/credit-reports", icon: CreditCard, module: "lending" },
      { label: "Collections",   href: "/lending/collections",  icon: AlertTriangle, module: "lending" },
      { label: "Products",      href: "/lending/products",     icon: FileSignature, module: "lending" },
    ],
  },
  {
    id: "aml",
    section: "Compliance",
    label: "AML",
    icon: ShieldAlert,
    module: "aml",
    badge: { text: "NEW", background: "rgba(99,102,241,0.15)", color: "#818cf8" },
    basePath: "/aml",
    items: [
      { label: "Dashboard", href: "/aml",         icon: LayoutDashboard, exact: true, module: "aml" },
      { label: "Cases",     href: "/aml/cases",    icon: ShieldAlert, module: "aml" },
      { label: "Watchlist Sync", href: "/aml/watchlist", icon: ListChecks, module: "aml" },
    ],
  },
  {
    id: "fraud",
    section: "Compliance",
    label: "Fraud",
    icon: ShieldX,
    module: "fraud",
    basePath: "/fraud",
    items: [
      { label: "Dashboard", href: "/fraud",       icon: LayoutDashboard, exact: true, module: "fraud" },
      { label: "Cases",     href: "/fraud/cases",  icon: ShieldX, module: "fraud" },
      { label: "Blacklist / Whitelist", href: "/fraud/lists", icon: ListChecks, module: "fraud" },
    ],
  },
  {
    id: "verification",
    section: "Compliance",
    label: "Verification",
    icon: BadgeCheck,
    module: "verification",
    basePath: "/verification",
    items: [
      { label: "Dashboard",   href: "/verification",              icon: LayoutDashboard, exact: true, module: "verification" },
      { label: "Cases",       href: "/verification/cases",         icon: BadgeCheck, module: "verification" },
      { label: "IFSC Lookup", href: "/verification/ifsc-lookup",   icon: Landmark, module: "verification" },
    ],
  },
  {
    id: "monitoring",
    section: "Compliance",
    label: "Monitoring",
    icon: Radar,
    module: "monitoring",
    badge: { text: "NEW", background: "rgba(99,102,241,0.15)", color: "#818cf8" },
    basePath: "/monitoring",
    items: [
      { label: "Dashboard", href: "/monitoring",         icon: LayoutDashboard, exact: true, module: "monitoring" },
      { label: "Alerts",    href: "/monitoring/alerts",   icon: Radar, module: "monitoring" },
      { label: "Cases",     href: "/monitoring/cases",    icon: FolderKanban, module: "monitoring" },
      { label: "Rules",     href: "/monitoring/rules",    icon: Settings2, module: "monitoring" },
    ],
  },
  {
    id: "treds",
    section: "Finance",
    label: "TReDS",
    icon: Landmark,
    badge: { text: "M1X", background: "rgba(16,185,129,0.15)", color: "#10b981" },
    basePath: "/customer/treds",
    items: [
      { label: "Dashboard",   href: "/customer/treds/dashboard",   icon: LayoutDashboard },
      { label: "Invoices",    href: "/customer/treds/invoices",    icon: FileText },
      { label: "Bids",        href: "/customer/treds/bids",        icon: Scale },
      { label: "Settlements", href: "/customer/treds/settlements", icon: Wallet },
      { label: "Reports",     href: "/customer/treds/reports",     icon: BarChart3 },
      { label: "Integration", href: "/customer/treds/integration", icon: Plug },
    ],
  },
  {
    id: "ai-bot",
    section: "AI Bot",
    label: "AI Bot",
    icon: Bot,
    feature: FEATURES.AI,
    badge: { text: "AI", background: "rgba(16,185,129,0.15)", color: "#34d399" },
    basePath: "/ai-bot",
    items: [
      { label: "Overview",   href: "/ai-bot",  icon: Sparkles, exact: true },
      { label: "AI Advisor", href: "/advisor", icon: Bot },
    ],
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  /** resolved permission strings for the current user (RBAC). When
   *  omitted, every module is shown (back-compat / loading). A CA
   *  inside a Client Workspace gets ["*"] — same as a real Owner
   *  session — so this renders identically for customers and CAs. */
  permissions?: string[];
}

export default function Sidebar({ open = false, onClose, permissions }: SidebarProps) {
  const pathname = usePathname();
  const { hasFeature } = useEntitlements();

  // Module-access predicate driving the dynamic sidebar. Without a
  // permission list (e.g. mid-hydration) everything stays visible.
  const canAccess = (module?: AppModule): boolean => {
    if (!module) return true;
    if (!permissions) return true;
    return hasModuleAccessFromList(permissions, module);
  };
  const settingsLocked = !canAccess("settings");

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={cn("sidebar", open && "sidebar--open")}>
        {/* Logo + mobile close button */}
        <div className="flex items-center gap-2 px-2 mb-8">
          <div
            style={{
              width: 32,
              height: 32,
              background: "linear-gradient(135deg, #6366f1, #10b981)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Zap size={16} color="white" />
          </div>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              background: "linear-gradient(135deg, #818cf8, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            FinRP
          </span>
          {/* Close button — mobile only */}
          <button
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation — collapsible module groups */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          {navGroups.map((group) => (
            <SidebarNavGroup
              key={group.id}
              group={group}
              pathname={pathname}
              onNavigate={onClose}
              canAccess={canAccess}
              hasFeature={hasFeature}
            />
          ))}
        </nav>

        {/* Bottom */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 12,
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {settingsLocked ? (
            <div
              className="sidebar-nav-item"
              aria-disabled="true"
              title="You don't have access to Settings"
              style={{ opacity: 0.45, cursor: "not-allowed" }}
            >
              <Settings size={16} strokeWidth={1.75} />
              <span>Settings</span>
              <Lock size={12} style={{ marginLeft: "auto", opacity: 0.7 }} />
            </div>
          ) : (
            <Link
              href="/settings"
              className={cn("sidebar-nav-item", pathname.startsWith("/settings") && "active")}
              onClick={onClose}
            >
              <Settings size={16} strokeWidth={1.75} />
              <span>Settings</span>
              {pathname.startsWith("/settings") && (
                <ChevronRight size={12} style={{ marginLeft: "auto", opacity: 0.5 }} />
              )}
            </Link>
          )}

          {/* AI Badge */}
          <div
            style={{
              margin: "8px 4px 0",
              padding: "10px 12px",
              background: "rgba(99, 102, 241, 0.08)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#10b981",
                flexShrink: 0,
                animation: "pulse 2s infinite",
              }}
            />
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#818cf8" }}>
                AI Advisor Active
              </p>
              <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                Gemini 2.5 Flash
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
