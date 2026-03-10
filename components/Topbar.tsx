"use client";

import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Bell, Search, ChevronRight } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/crm": "CRM",
  "/billing": "Billing",
  "/finance": "Finance",
  "/compliance": "Compliance",
  "/advisor": "AI Advisor",
  "/settings": "Settings",
};

export default function Topbar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <header className="topbar">
      {/* Breadcrumb */}
      <div
        style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>FinRP</span>
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const label = routeLabels[href] || seg.charAt(0).toUpperCase() + seg.slice(1);
          return (
            <span
              key={href}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <ChevronRight size={12} color="var(--text-muted)" />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: i === segments.length - 1 ? 600 : 400,
                  color:
                    i === segments.length - 1
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
              >
                {label}
              </span>
            </span>
          );
        })}
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "6px 12px",
          width: 240,
          marginRight: 12,
          cursor: "text",
        }}
      >
        <Search size={14} color="var(--text-muted)" />
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Search...
        </span>
        <kbd
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "var(--text-muted)",
            background: "rgba(255,255,255,0.06)",
            padding: "1px 5px",
            borderRadius: 4,
            border: "1px solid var(--border)",
          }}
        >
          ⌘K
        </kbd>
      </div>

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            position: "relative",
          }}
        >
          <Bell size={18} />
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#ef4444",
              border: "2px solid var(--bg-base)",
            }}
          />
        </button>
        <UserButton
          appearance={{
            elements: {
              avatarBox: {
                width: 30,
                height: 30,
              },
            },
          }}
        />
      </div>
    </header>
  );
}
