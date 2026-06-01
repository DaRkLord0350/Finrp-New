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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard",   href: "/firm",              icon: LayoutDashboard, exact: true },
  { label: "Customers",   href: "/firm/customers",    icon: Users },
  { label: "Team",        href: "/firm/team",         icon: UserCog },
  { label: "Assignments", href: "/firm/assignments",  icon: UserPlus },
  { label: "Tasks",       href: "/firm/tasks",        icon: ClipboardList },
  { label: "Documents",   href: "/firm/documents",    icon: FolderOpen },
  { label: "Reports",     href: "/firm/reports",      icon: BarChart3 },
];

interface FirmSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function FirmSidebar({ open = false, onClose }: FirmSidebarProps) {
  const pathname = usePathname();

  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

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
              Firm Management
            </p>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
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
            Practice
          </p>

          {navItems.map((item) => {
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
          })}
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
            href="/firm/settings"
            className={cn("sidebar-nav-item", pathname.startsWith("/firm/settings") && "active")}
            onClick={onClose}
          >
            <Settings size={16} strokeWidth={1.75} />
            <span>Settings</span>
          </Link>

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
                <p style={{ fontSize: 11, fontWeight: 600, color: "#34d399" }}>
                  CA Firm Portal
                </p>
                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Practice Management
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
