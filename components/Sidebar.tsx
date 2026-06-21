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
  TrendingUp,
  ShoppingCart,
  Receipt,
  Percent,
  Eye,
  Sparkles,
  FilePlus2,
  Lock,
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
      { label: "Transactions",   href: "/banking/transactions",   icon: Wallet },
      { label: "Reconciliation", href: "/banking/reconciliation", icon: Scale },
      { label: "Cash Flow",      href: "/banking/cash-flow",      icon: BarChart3 },
      { label: "GST Match",      href: "/banking/gst-match",      icon: ShieldCheck },
      { label: "AI Insights",    href: "/banking/ai-insights",    icon: Bot, feature: FEATURES.AI },
    ],
    footer: { label: "View all →", href: "/banking" },
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

// ── Client Workspace nav ──────────────────────────────────────
// Shown instead of the customer nav when a CA is impersonating a
// client. Every href is an EXISTING customer route — the tenant
// override makes them serve the client org. Items gated by a
// ClientPermission disappear when the CA's assignment lacks it.
const workspaceNavItems: Array<{
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
  match: (pathname: string) => boolean;
}> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "VIEW_DASHBOARD",
    match: (p) => p === "/dashboard" || p.startsWith("/dashboard/") },
  { label: "Banking", href: "/banking/dashboard", icon: Landmark, permission: "MANAGE_BANKING",
    match: (p) => p.startsWith("/banking") && !p.startsWith("/banking/gst") },
  { label: "Sales", href: "/erp/sales", icon: TrendingUp,
    match: (p) => p.startsWith("/erp/sales") },
  { label: "Purchases", href: "/erp/purchases", icon: ShoppingCart,
    match: (p) => p.startsWith("/erp/purchases") },
  { label: "Expenses", href: "/erp/expenses", icon: Receipt,
    match: (p) => p.startsWith("/erp/expenses") },
  { label: "GST", href: "/banking/gst-match", icon: ShieldCheck, permission: "MANAGE_GST",
    match: (p) => p.startsWith("/banking/gst") },
  { label: "TDS", href: "/tds", icon: Percent, permission: "MANAGE_TDS",
    match: (p) => p.startsWith("/tds") },
  { label: "Payroll", href: "/erp/payroll", icon: Users, permission: "MANAGE_PAYROLL",
    match: (p) => p.startsWith("/erp/payroll") },
  { label: "Documents", href: "/customer/documents", icon: FileText, permission: "MANAGE_DOCUMENTS",
    match: (p) => p.startsWith("/customer/documents") },
  { label: "Reports", href: "/reports", icon: BarChart2,
    match: (p) => p.startsWith("/reports") },
];

interface SidebarWorkspace {
  clientName: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
  /** present when a CA is viewing a client workspace */
  workspace?: SidebarWorkspace;
  /** resolved permission strings for the current user (RBAC). When
   *  omitted, every module is shown (back-compat / loading). */
  permissions?: string[];
}

export default function Sidebar({ open = false, onClose, workspace, permissions }: SidebarProps) {
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

  // ── Workspace mode: client-scoped module nav ────────────────
  if (workspace) {
    const visibleItems = workspaceNavItems.filter(
      (item) =>
        !item.permission ||
        workspace.isSuperAdmin ||
        workspace.permissions.includes(item.permission)
    );

    return (
      <>
        {open && (
          <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />
        )}

        <aside className={cn("sidebar", open && "sidebar--open")}>
          {/* Logo + mobile close button */}
          <div className="flex items-center gap-2 px-2 mb-4">
            <div
              style={{
                width: 32,
                height: 32,
                background: "linear-gradient(135deg, #6366f1, #0ea5e9)",
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
                background: "linear-gradient(135deg, #818cf8, #38bdf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              FinRP
            </span>
            <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
              <X size={18} />
            </button>
          </div>

          {/* Client chip */}
          <div
            style={{
              margin: "0 2px 14px",
              padding: "9px 11px",
              borderRadius: 10,
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.25)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Eye size={13} color="#818cf8" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#818cf8" }}>
                Viewing client
              </p>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {workspace.clientName}
              </p>
            </div>
          </div>

          {/* Workspace navigation */}
          <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                padding: "0 12px",
                marginBottom: 6,
              }}
            >
              Client Modules
            </p>

            {visibleItems.map((item) => {
              const isActive = item.match(pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("sidebar-nav-item", isActive && "active")}
                  onClick={onClose}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  <span>{item.label}</span>
                  {isActive && (
                    <ChevronRight size={12} style={{ marginLeft: "auto", opacity: 0.5 }} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Bottom — impersonation notice */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
              marginTop: 12,
            }}
          >
            <div
              style={{
                margin: "0 4px",
                padding: "10px 12px",
                background: "rgba(124, 58, 237, 0.08)",
                border: "1px solid rgba(124, 58, 237, 0.25)",
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
                  background: "#7c3aed",
                  flexShrink: 0,
                  animation: "pulse 2s infinite",
                }}
              />
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#a78bfa" }}>
                  Impersonation active
                </p>
                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Actions are audit-logged
                </p>
              </div>
            </div>
          </div>
        </aside>
      </>
    );
  }

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
