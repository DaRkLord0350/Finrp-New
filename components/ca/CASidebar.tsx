"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  CheckSquare,
  ClipboardList,
  ClipboardCheck,
  Calendar,
  MessageSquare,
  Bell,
  Settings,
  X,
  Briefcase,
  Scale,
  Building2,
  UserCheck,
  UserCog,
  History,
  FileText,
  FileSearch,
  Gauge,
  Layers,
  Percent,
  IndianRupee,
  Receipt,
  ScrollText,
  BarChart2,
  BarChart3,
  TrendingUp,
  Bot,
  Inbox,
  BadgeCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNavGroup, type NavGroupConfig } from "@/components/SidebarNavGroup";

// ── CA Practice navigation config ─────────────────────────────
// Each top-level practice area is a collapsible group rendered by
// the shared <SidebarNavGroup> (same accordion as Banking OS).
// New modules are added here by configuration only. Items flagged
// `comingSoon` render as disabled rows until their page ships —
// flip the flag when the route exists.
//
// /ca-hub/* hrefs launch modules that live in the CA Hub shell;
// everything else stays inside this portal.

const caNavGroups: NavGroupConfig[] = [
  {
    id: "workspace",
    label: "Workspace",
    icon: Briefcase,
    items: [
      { label: "Dashboard",         href: "/ca",               icon: LayoutDashboard, exact: true },
      { label: "My Tasks",          href: "/ca/tasks",         icon: ClipboardList },
      { label: "Compliance Center", href: "/ca/compliance",    icon: ShieldCheck },
      { label: "Documents",         href: "/ca/documents",     icon: CheckSquare },
      { label: "Document Requests", href: "/ca/document-requests", icon: Inbox },
      { label: "Approvals",         href: "/ca/approvals",     icon: BadgeCheck },
      { label: "Verification",      href: "/ca/verification",  icon: CheckSquare },
      { label: "Deadlines",         href: "/ca/deadlines",     icon: Calendar },
      { label: "Messages",          href: "/ca/messages",      icon: MessageSquare },
      { label: "Notifications",     href: "/ca/notifications", icon: Bell },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    items: [
      { label: "All Customers",      href: "/ca/customers/all",      icon: Building2 },
      { label: "Assigned Customers", href: "/ca/customers/assigned", icon: UserCheck },
      { label: "Workspace Activity", href: "/ca/customers/activity", icon: History },
      { label: "Customer Records",   href: "/ca/customers",          icon: Users, exact: true },
      { label: "Clients (Orgs)",     href: "/ca/clients",            icon: Users, activePrefix: "/ca/client" },
    ],
  },
  {
    id: "practice",
    label: "Practice",
    icon: UserCog,
    items: [
      { label: "Team Members",      href: "/ca-hub/team",            icon: UserCog },
      { label: "Assignments",       href: "/ca/practice/assignments", icon: ClipboardCheck, comingSoon: true },
      { label: "Reviews",           href: "/ca/practice/reviews",     icon: FileSearch,     comingSoon: true },
      { label: "Capacity Planning", href: "/ca/practice/capacity",    icon: Gauge,          comingSoon: true },
      { label: "Work Allocation",   href: "/ca/practice/allocation",  icon: Layers,         comingSoon: true },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
    items: [
      { label: "Filings",    href: "/ca/filings",           icon: FileText },
      { label: "GST",        href: "/ca-hub/gst",           icon: Percent },
      { label: "Income Tax", href: "/ca-hub/income-tax",    icon: IndianRupee },
      { label: "TDS",        href: "/ca-hub/tds",           icon: Receipt },
      { label: "MCA",        href: "/ca/compliance/mca",    icon: Building2, comingSoon: true },
      { label: "ROC",        href: "/ca-hub/roc",           icon: ScrollText },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    items: [
      { label: "Reports",    href: "/ca/insights/reports", icon: BarChart2, comingSoon: true },
      { label: "Analytics",  href: "/ca-hub/analytics",    icon: TrendingUp },
      { label: "AI Advisor", href: "/ca-hub/copilot",      icon: Bot },
    ],
  },
];

interface CASidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function CASidebar({ open = false, onClose }: CASidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={cn("sidebar", open && "sidebar--open")}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 mb-8">
          <div
            style={{
              width: 32,
              height: 32,
              background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Briefcase size={16} color="white" />
          </div>
          <div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                background: "linear-gradient(135deg, #38bdf8, #818cf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              FinRP CA
            </span>
            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 0 }}>
              Practice Portal
            </p>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* CA Hub launcher */}
        <Link
          href="/ca-hub"
          onClick={onClose}
          style={{
            display: "flex", alignItems: "center", gap: 10, textDecoration: "none",
            margin: "0 2px 12px", padding: "11px 12px", borderRadius: 11,
            background: "linear-gradient(135deg, rgba(99,102,241,0.16), rgba(14,165,233,0.16))",
            border: "1px solid rgba(99,102,241,0.3)",
          }}
        >
          <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Scale size={16} color="white" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>CA Hub</p>
            <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Practice Operating System</p>
          </div>
          <span style={{ fontSize: 8.5, fontWeight: 800, color: "#818cf8", background: "rgba(99,102,241,0.2)", padding: "2px 6px", borderRadius: 5, letterSpacing: "0.04em" }}>NEW</span>
        </Link>

        {/* Navigation — collapsible practice groups */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "0 12px",
              marginBottom: 4,
            }}
          >
            Practice Management
          </p>

          {caNavGroups.map((group) => (
            <SidebarNavGroup
              key={group.id}
              group={group}
              pathname={pathname}
              onNavigate={onClose}
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
          <Link
            href="/ca/settings"
            className={cn("sidebar-nav-item", pathname.startsWith("/ca/settings") && "active")}
            onClick={onClose}
          >
            <Settings size={16} strokeWidth={1.75} />
            <span>Settings</span>
          </Link>

          <div
            style={{
              margin: "8px 4px 0",
              padding: "10px 12px",
              background: "rgba(14, 165, 233, 0.08)",
              border: "1px solid rgba(14, 165, 233, 0.2)",
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#0ea5e9",
                  flexShrink: 0,
                  animation: "pulse 2s infinite",
                }}
              />
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#38bdf8" }}>
                  CA Practice Portal
                </p>
                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Compliance Workspace
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
