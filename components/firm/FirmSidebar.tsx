"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  UserPlus,
  ClipboardList,
  FolderOpen,
  BarChart3,
  Settings,
  X,
  Briefcase,
  FileText,
  Activity,
  TrendingUp,
  PenLine,
  Palette,
  Bell,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";

const practiceItems = [
  { label: "Dashboard",    href: "/firm",              icon: LayoutDashboard, exact: true },
  { label: "Customers",    href: "/firm/customers",    icon: Users },
  { label: "Team",         href: "/firm/team",         icon: UserCog },
  { label: "Assignments",  href: "/firm/assignments",  icon: UserPlus },
  { label: "Tasks",        href: "/firm/tasks",        icon: ClipboardList },
  { label: "Templates",    href: "/firm/templates",    icon: FileText },
  { label: "Documents",    href: "/firm/documents",    icon: FolderOpen },
];

const operationsItems = [
  { label: "Workload",     href: "/firm/workload",     icon: Activity },
  { label: "Analytics",   href: "/firm/analytics",    icon: TrendingUp },
  { label: "Reports",     href: "/firm/reports",      icon: BarChart3 },
  { label: "E-Sign",      href: "/firm/esign",        icon: PenLine },
];

const settingsItems = [
  { label: "Branding",    href: "/firm/branding",     icon: Palette },
  { label: "Notifications", href: "/firm/settings/notifications", icon: Bell },
  { label: "Settings",    href: "/firm/settings",     icon: Settings, exact: true },
];

interface FirmSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function FirmSidebar({ open = false, onClose }: FirmSidebarProps) {
  const pathname = usePathname();

  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const renderItems = (items: typeof practiceItems) =>
    items.map((item) => {
      const active = isActive(item);
      const Icon = item.icon;
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn("sidebar-nav-item", active && "active")}
          onClick={onClose}
        >
          <Icon size={16} strokeWidth={1.75} />
          <span>{item.label}</span>
        </Link>
      );
    });

  return (
    <>
      {open && (
        <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={cn("sidebar", open && "sidebar--open")}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 mb-6">
          <div
            style={{
              width: 32,
              height: 32,
              background: "linear-gradient(135deg, #10b981, #0ea5e9)",
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
                background: "linear-gradient(135deg, #34d399, #38bdf8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              FinRP Firm
            </span>
            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 0 }}>
              Practice Management
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

        {/* Navigation */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 12px", marginBottom: 4 }}>
            Practice
          </p>
          {renderItems(practiceItems)}

          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", padding: "8px 12px 4px" }}>
            Operations
          </p>
          {renderItems(operationsItems)}
        </nav>

        {/* Bottom */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 10,
            marginTop: 8,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 12px", marginBottom: 4 }}>
            Configure
          </p>
          {renderItems(settingsItems)}

          <div
            style={{
              margin: "8px 4px 0",
              padding: "10px 12px",
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                <p style={{ fontSize: 11, fontWeight: 600, color: "#34d399" }}>CA Firm Portal</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Phase 2 Active</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
