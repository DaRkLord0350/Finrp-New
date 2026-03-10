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
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "CRM",
    href: "/crm",
    icon: Users,
  },
  {
    label: "Billing",
    href: "/billing",
    icon: FileText,
  },
  {
    label: "Finance",
    href: "/finance",
    icon: BarChart3,
  },
  {
    label: "Compliance",
    href: "/compliance",
    icon: ShieldCheck,
  },
  {
    label: "AI Advisor",
    href: "/advisor",
    icon: Bot,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo */}
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
        <Link href="/settings" className="sidebar-nav-item">
          <Settings size={16} strokeWidth={1.75} />
          <span>Settings</span>
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
  );
}
