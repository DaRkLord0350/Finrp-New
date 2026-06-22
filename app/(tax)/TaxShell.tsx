"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ReceiptText, FileText, FileCheck2, Calculator, GitCompareArrows,
  Send, Landmark, Coins, TrendingUp, Scale, BookOpen, ShieldCheck, Gauge, Settings2,
  Menu, X, ShieldCheck as Logo,
} from "lucide-react";
import { TAX_NAV } from "@/lib/tax/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  LayoutDashboard, ReceiptText, FileText, FileCheck2, Calculator, GitCompareArrows,
  Send, Landmark, Coins, TrendingUp, Scale, BookOpen, ShieldCheck, Gauge, Settings2,
};

export default function TaxShell({ children, userName }: { children: React.ReactNode; userName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/tax" ? pathname === "/tax" : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-card transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Logo size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Tax Engine</p>
            <p className="text-[11px] text-muted-foreground">Compliance OS</p>
          </div>
        </div>

        <nav className="flex flex-col gap-5 overflow-y-auto px-3 py-4" style={{ height: "calc(100vh - 4rem)" }}>
          {TAX_NAV.map((section) => (
            <div key={section.title}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = ICONS[item.icon] ?? FileText;
                  const active = isActive(item.href);
                  if (item.status === "soon") {
                    return (
                      <div
                        key={item.href}
                        className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground/60"
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon size={16} />
                          {item.label}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase">Soon</span>
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-md p-2 hover:bg-muted lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="hidden text-sm text-muted-foreground lg:block">
            Tax &amp; Compliance Engine
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{userName}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {userName.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
