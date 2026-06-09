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
  ChevronDown,
  X,
  Landmark,
  Scale,
  Wallet,
  Plug,
  BarChart2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "CRM", href: "/crm", icon: Users },
  { label: "Billing", href: "/billing", icon: FileText },
  { label: "Finance", href: "/finance", icon: BarChart3 },
  { label: "Accounting", href: "/accounting/chart-of-accounts", icon: Wallet },
  { label: "ERP", href: "/erp", icon: Boxes },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck },
  { label: "Reports", href: "/reports", icon: BarChart2 },

  { label: "AI Advisor", href: "/advisor", icon: Bot },
];

const tredsSubItems = [
  { label: "Dashboard",   href: "/customer/treds/dashboard",   icon: LayoutDashboard },
  { label: "Invoices",    href: "/customer/treds/invoices",    icon: FileText },
  { label: "Bids",        href: "/customer/treds/bids",        icon: Scale },
  { label: "Settlements", href: "/customer/treds/settlements", icon: Wallet },
  { label: "Reports",     href: "/customer/treds/reports",     icon: BarChart3 },
  { label: "Integration", href: "/customer/treds/integration", icon: Plug },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const inTreds = pathname.startsWith("/customer/treds");
  const [tredsOpen, setTredsOpen] = useState(inTreds);
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
            Main Menu
          </p>

          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
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
                  <ChevronRight
                    size={12}
                    style={{ marginLeft: "auto", opacity: 0.5 }}
                  />
                )}
              </Link>
            );
          })}

          {/* ── TReDS Section ────────────────────────── */}
          <div style={{ marginTop: 4 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                padding: "8px 12px 4px",
              }}
            >
              Finance
            </p>

            {/* TReDS parent toggle */}
            <button
              className={cn("sidebar-nav-item", inTreds && "active")}
              onClick={() => setTredsOpen((v) => !v)}
              style={{ width: "100%", textAlign: "left" }}
            >
              <Landmark size={16} strokeWidth={1.75} />
              <span>TReDS</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    fontSize: 9,
                    background: "rgba(16,185,129,0.15)",
                    color: "#10b981",
                    padding: "1px 5px",
                    borderRadius: 4,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  M1X
                </span>
                <ChevronDown
                  size={12}
                  style={{
                    transform: tredsOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                    opacity: 0.6,
                  }}
                />
              </div>
            </button>

            {/* TReDS sub-items */}
            {tredsOpen && (
              <div
                style={{
                  paddingLeft: 24,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  marginTop: 2,
                  borderLeft: "1px solid var(--border)",
                  marginLeft: 20,
                }}
              >
                {tredsSubItems.map((item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn("sidebar-nav-item", active && "active")}
                      onClick={onClose}
                      style={{ fontSize: 13, padding: "7px 10px" }}
                    >
                      <Icon size={13} strokeWidth={1.75} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
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
