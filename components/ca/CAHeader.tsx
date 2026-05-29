"use client";

import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Bell, Search, ChevronRight, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const routeLabels: Record<string, string> = {
  "/ca":              "Dashboard",
  "/ca/clients":      "Clients",
  "/ca/compliance":   "Compliance Center",
  "/ca/verification": "Verification",
  "/ca/filings":      "Filing Queue",
  "/ca/deadlines":    "Deadlines",
  "/ca/messages":     "Messages",
  "/ca/notifications":"Notifications",
  "/ca/settings":     "Settings",
};

interface CAHeaderProps {
  onMenuClick?: () => void;
}

export default function CAHeader({ onMenuClick }: CAHeaderProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const buildLabel = (segments: string[]) => {
    const fullPath = "/" + segments.join("/");
    return routeLabels[fullPath] || segments[segments.length - 1]?.charAt(0).toUpperCase() + segments[segments.length - 1]?.slice(1);
  };

  return (
    <header className="topbar">
      <button className="topbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={20} />
      </button>

      {/* Breadcrumb */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>FinRP CA</span>
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

      {/* Search */}
      <div className="topbar-search">
        <Search size={14} color="var(--text-muted)" />
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Search clients, compliances...</span>
        <kbd style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--border)" }}>
          ⌘K
        </kbd>
      </div>

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <ThemeToggle />
        <button
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", display: "flex", alignItems: "center", position: "relative" }}
        >
          <Bell size={18} />
          <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: "50%", background: "#ef4444", border: "2px solid var(--bg-base)" }} />
        </button>
        <UserButton appearance={{ elements: { avatarBox: { width: 30, height: 30 } } }} />
      </div>
    </header>
  );
}
