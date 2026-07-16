"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  BarChart3,
  Settings,
  X,
  Shield,
  UserCog,
  FileText,
  Landmark,
  Activity,
  HandCoins,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard",   href: "/admin",            icon: LayoutDashboard, exact: true },
  { label: "Firms",       href: "/admin/firms",       icon: Building2 },
  { label: "Customers",   href: "/admin/customers",   icon: Users },
  { label: "Users",       href: "/admin/users",       icon: UserCog },
  { label: "Compliance",  href: "/admin/compliance",  icon: ShieldCheck },
  { label: "Analytics",   href: "/admin/analytics",   icon: BarChart3 },
];

// TBX Foundation (Phase 1) — Module 9 Admin Dashboard
const kycNavItems = [
  { label: "KYC Queue",          href: "/admin/kyc",              icon: ShieldCheck },
  { label: "Documents",          href: "/admin/documents",        icon: FileText },
  { label: "Bank Verification",  href: "/admin/bank-verification", icon: Landmark },
  { label: "TBX Logs",           href: "/admin/tbx-logs",         icon: Activity },
];

// Phase 3 — Module 1 Lending Platform admin (cross-tenant)
const lendingNavItems = [
  { label: "Lending Platform", href: "/admin/lending", icon: HandCoins },
];

// Phase 3 — Module 3 AML admin (cross-tenant, global watchlist data)
const amlNavItems = [
  { label: "AML Watchlist", href: "/admin/aml", icon: ShieldAlert },
];

interface AdminSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function AdminSidebar({ open = false, onClose }: AdminSidebarProps) {
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
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Shield size={16} color="white" />
          </div>
          <div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                background: "linear-gradient(135deg, #818cf8, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              FinRP Admin
            </span>
            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 0 }}>
              Platform Control
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
            Platform
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

          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "0 12px",
              marginTop: 16,
              marginBottom: 6,
            }}
          >
            KYC &amp; Verification
          </p>

          {kycNavItems.map((item) => {
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

          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "0 12px",
              marginTop: 16,
              marginBottom: 6,
            }}
          >
            Lending
          </p>

          {lendingNavItems.map((item) => {
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

          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "0 12px",
              marginTop: 16,
              marginBottom: 6,
            }}
          >
            AML
          </p>

          {amlNavItems.map((item) => {
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
            href="/admin/settings"
            className={cn("sidebar-nav-item", pathname.startsWith("/admin/settings") && "active")}
            onClick={onClose}
          >
            <Settings size={16} strokeWidth={1.75} />
            <span>Settings</span>
          </Link>

          <div
            style={{
              margin: "8px 4px 0",
              padding: "10px 12px",
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#6366f1",
                  flexShrink: 0,
                  animation: "pulse 2s infinite",
                }}
              />
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#818cf8" }}>
                  Admin Portal
                </p>
                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  Full Platform Access
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
