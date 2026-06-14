"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home, Star, Share2, FileText, Clock, ChevronRight, ChevronDown,
  LayoutDashboard, ShoppingCart, Boxes, DollarSign, ArrowDownCircle,
  CircleCheck, RefreshCw, ArrowUpCircle, ShoppingBag, Percent,
  Landmark, FolderOpen, BookOpen, PiggyBank, Globe, Activity, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { REPORT_CATEGORIES } from "@/lib/reports/registry";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  LayoutDashboard, ShoppingCart, Boxes, DollarSign,
  ArrowDownCircle, CircleCheck, RefreshCw, ArrowUpCircle,
  ShoppingBag, Percent, Landmark, FolderOpen, BookOpen,
  PiggyBank, Globe, Activity, Zap,
};

const TOP_LINKS = [
  { label: "Home",             href: "/reports",            icon: Home },
  { label: "Favorites",        href: "/reports/favorites",  icon: Star },
  { label: "Shared Reports",   href: "/reports/shared",     icon: Share2 },
  { label: "My Reports",       href: "/reports/my-reports", icon: FileText },
  { label: "Scheduled Reports",href: "/reports/scheduled",  icon: Clock },
];

export default function ReportsSidebar() {
  const pathname     = usePathname();
  const [open, setOpen] = useState(true);

  const categories = Object.entries(REPORT_CATEGORIES);

  return (
    <aside
      style={{
        width:         240,
        flexShrink:    0,
        borderRight:   "1px solid var(--border)",
        background:    "var(--bg-surface)",
        height:        "100%",
        overflowY:     "auto",
        padding:       "16px 0",
        display:       "flex",
        flexDirection: "column",
        gap:           0,
      }}
    >
      {/* Top links */}
      <div style={{ padding: "0 8px 12px" }}>
        {TOP_LINKS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display:        "flex",
                alignItems:     "center",
                gap:            10,
                padding:        "8px 10px",
                borderRadius:   8,
                fontSize:       13,
                fontWeight:     active ? 600 : 400,
                color:          active ? "var(--accent)" : "var(--text-secondary)",
                background:     active ? "var(--accent-subtle)" : "transparent",
                textDecoration: "none",
                marginBottom:   2,
                transition:     "all 0.15s",
              }}
            >
              <item.icon size={15} />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)", margin: "4px 0 12px" }} />

      {/* Category tree */}
      <div style={{ padding: "0 8px" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            6,
            padding:        "4px 10px",
            background:     "none",
            border:         "none",
            cursor:         "pointer",
            fontSize:       11,
            fontWeight:     600,
            letterSpacing:  "0.06em",
            color:          "var(--text-muted)",
            textTransform:  "uppercase",
            width:          "100%",
            marginBottom:   4,
          }}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Report Categories
        </button>

        {open && categories.map(([key, meta]) => {
          const Icon   = ICON_MAP[meta.icon] ?? Boxes;
          const active = pathname.startsWith(`/reports/category/${key}`);
          return (
            <Link
              key={key}
              href={`/reports/category/${key}`}
              style={{
                display:        "flex",
                alignItems:     "center",
                gap:            9,
                padding:        "7px 10px",
                borderRadius:   7,
                fontSize:       12.5,
                fontWeight:     active ? 600 : 400,
                color:          active ? "var(--accent)" : "var(--text-secondary)",
                background:     active ? "var(--accent-subtle)" : "transparent",
                textDecoration: "none",
                marginBottom:   1,
                transition:     "all 0.12s",
              }}
            >
              <Icon size={14} />
              {meta.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
