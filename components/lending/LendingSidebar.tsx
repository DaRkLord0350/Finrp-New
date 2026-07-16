"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  FilePlus2,
  HandCoins,
  AlertTriangle,
  FileSignature,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard; exact?: boolean };

const lendingNav: NavItem[] = [
  { label: "Portfolio",      href: "/lending",              icon: LayoutDashboard, exact: true },
  { label: "Applications",   href: "/lending/applications", icon: ClipboardList },
  { label: "New Application", href: "/lending/applications/new", icon: FilePlus2 },
  { label: "Loan Accounts",  href: "/lending/accounts",     icon: HandCoins },
  { label: "Credit Reports", href: "/lending/credit-reports", icon: CreditCard },
  { label: "Collections",    href: "/lending/collections",  icon: AlertTriangle },
  { label: "Products",       href: "/lending/products",     icon: FileSignature },
];

export default function LendingSidebar() {
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
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Lending
        </p>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
          Loan Origination System
        </p>
      </div>

      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1, marginTop: 12 }}>
        {lendingNav.map((item) => {
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
