"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShieldAlert, ListChecks, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard; exact?: boolean };

const amlNav: NavItem[] = [
  { label: "Dashboard", href: "/aml", icon: LayoutDashboard, exact: true },
  { label: "Cases", href: "/aml/cases", icon: ShieldAlert },
  { label: "Watchlist Sync", href: "/aml/watchlist", icon: ListChecks },
];

export default function AMLSidebar() {
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
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>AML</p>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Anti-Money Laundering</p>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, marginTop: 12 }}>
        {amlNav.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("sidebar-nav-item", isActive && "active")} style={{ fontSize: 13, padding: "8px 10px" }}>
              <Icon size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {isActive && <ChevronRight size={10} style={{ opacity: 0.5 }} />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
