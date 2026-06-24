"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  KeyRound,
  FolderCheck,
  FileSignature,
  Briefcase,
  ShieldCheck,
  UserCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── CA Portal navigation — flat, customer-centric (9 items) ───
interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  activePrefix?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/ca", icon: LayoutDashboard, exact: true },
  { label: "My Clients", href: "/ca/clients", icon: Users, activePrefix: "/ca/clients" },
  { label: "Tasks", href: "/ca/tasks", icon: ClipboardList },
  { label: "Virtual Access", href: "/ca/virtual-access", icon: KeyRound },
  { label: "Documents", href: "/ca/documents", icon: FolderCheck },
  { label: "Agreements", href: "/ca/agreements", icon: FileSignature },
  { label: "Workspace", href: "/ca/workspace", icon: Briefcase },
  { label: "Compliance Center", href: "/ca/compliance", icon: ShieldCheck },
  { label: "Profile", href: "/ca/profile", icon: UserCircle },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.activePrefix) {
    return pathname === item.activePrefix || pathname.startsWith(item.activePrefix + "/");
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

interface CASidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function CASidebar({ open = false, onClose }: CASidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}

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

        {/* Navigation */}
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
            Workspace
          </p>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item);
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

        {/* Bottom status */}
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
                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Client-first workspace</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
