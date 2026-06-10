"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  GitMerge,
  Wand2,
  TrendingUp,
  Receipt,
  BrainCircuit,
  ShieldAlert,
  KeyRound,
  Plug2,
  Upload,
  Download,
  Settings2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const bankingNav = [
  { label: "Dashboard",         href: "/banking/dashboard",     icon: LayoutDashboard },
  { label: "Bank Accounts",     href: "/banking/accounts",      icon: Building2 },
  { label: "Transactions",      href: "/banking/transactions",  icon: ArrowLeftRight },
  { label: "Reconciliation",    href: "/banking/reconciliation",icon: GitMerge },
  { label: "Rules Engine",      href: "/banking/rules",         icon: Wand2 },
  { label: "Cash Flow",         href: "/banking/cash-flow",     icon: TrendingUp },
  { label: "GST Match Center",  href: "/banking/gst-match",     icon: Receipt },
  { label: "AI Insights",       href: "/banking/ai-insights",   icon: BrainCircuit, badge: "AI" },
  { label: "Risk Center",       href: "/banking/risk-center",   icon: ShieldAlert },
  { label: "Consent Manager",   href: "/banking/consent",       icon: KeyRound },
  { label: "Bank Connections",  href: "/banking/connections",   icon: Plug2 },
  { label: "Import Statements", href: "/banking/import",        icon: Upload },
  { label: "Export Center",     href: "/banking/export",        icon: Download },
  { label: "Settings",          href: "/banking/settings",      icon: Settings2 },
];

export default function BankingSidebar() {
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
      {/* Header */}
      <div style={{ padding: "0 8px 12px", borderBottom: "1px solid var(--border)" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Banking OS
        </p>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
          Financial Intelligence
        </p>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, marginTop: 12 }}>
        {bankingNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
              {isActive && !item.badge && (
                <ChevronRight size={10} style={{ opacity: 0.5 }} />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
