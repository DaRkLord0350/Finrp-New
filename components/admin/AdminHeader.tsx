"use client";

import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Bell, ChevronRight, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const routeLabels: Record<string, string> = {
  "/admin":             "Dashboard",
  "/admin/firms":       "Firms",
  "/admin/customers":   "Customers",
  "/admin/users":       "Users",
  "/admin/compliance":  "Compliance",
  "/admin/analytics":   "Analytics",
  "/admin/settings":    "Settings",
};

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

export default function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="topbar">
      <button className="topbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>FinRP Admin</span>
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const label = routeLabels[href] || seg.charAt(0).toUpperCase() + seg.slice(1);
          return (
            <span key={href} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <ChevronRight size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: i === segments.length - 1 ? 600 : 400,
                  color: i === segments.length - 1 ? "var(--text-primary)" : "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </span>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <ThemeToggle />
        <button
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", position: "relative" }}
        >
          <Bell size={18} />
        </button>
        <UserButton appearance={{ elements: { avatarBox: { width: 30, height: 30 } } }} />
      </div>
    </header>
  );
}
