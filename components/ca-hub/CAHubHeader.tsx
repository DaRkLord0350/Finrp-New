"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Bell, Search, ChevronRight, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CA_HUB_MODULES } from "@/lib/ca-hub/nav";

interface Props {
  onMenuClick?: () => void;
}

export default function CAHubHeader({ onMenuClick }: Props) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); // ["ca-hub", "<slug>", ...]
  const slug = segments[1] ?? "";
  const activeModule =
    CA_HUB_MODULES.find((m) => m.slug === slug) ??
    CA_HUB_MODULES.find((m) => m.slug === "");

  return (
    <header className="topbar">
      <button className="topbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={20} />
      </button>

      {/* Breadcrumb */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <Link href="/ca-hub" style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0, textDecoration: "none" }}>
          CA Hub
        </Link>
        {activeModule && activeModule.slug !== "" && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <ChevronRight size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {activeModule.label}
            </span>
          </span>
        )}
        {activeModule?.slug === "" && (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ChevronRight size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Practice Dashboard</span>
          </span>
        )}
      </div>

      {/* Search */}
      <div className="topbar-search">
        <Search size={14} color="var(--text-muted)" />
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Search clients, filings…</span>
        <kbd
          style={{
            marginLeft: "auto", fontSize: 10, color: "var(--text-muted)",
            background: "rgba(128,128,128,0.10)", padding: "1px 5px",
            borderRadius: 4, border: "1px solid var(--border)",
          }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <ThemeToggle />
        <button
          aria-label="Notifications"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-secondary)", display: "flex", alignItems: "center", position: "relative",
          }}
        >
          <Bell size={18} />
          <span
            style={{
              position: "absolute", top: -2, right: -2, width: 8, height: 8,
              borderRadius: "50%", background: "#ef4444", border: "2px solid var(--bg-base)",
            }}
          />
        </button>
        <UserButton appearance={{ elements: { avatarBox: { width: 30, height: 30 } } }} />
      </div>
    </header>
  );
}
