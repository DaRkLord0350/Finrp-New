"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Scale, ArrowLeft, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CA_HUB_NAV_GROUPS } from "@/lib/ca-hub/nav";
import { SidebarNavGroup } from "@/components/SidebarNavGroup";

interface Props {
  open?: boolean;
  onClose?: () => void;
}

export default function CAHubSidebar({ open = false, onClose }: Props) {
  const pathname = usePathname();

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}

      <aside className={cn("sidebar", open && "sidebar--open")}>
        {/* Brand */}
        <div className="flex items-center gap-2 px-2 mb-6">
          <div
            style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "linear-gradient(135deg, #6366f1, #0ea5e9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 12px rgba(99,102,241,0.35)",
            }}
          >
            <Scale size={17} color="white" />
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <span
              style={{
                fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em",
                background: "linear-gradient(135deg, #818cf8, #38bdf8)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}
            >
              CA Hub
            </span>
            <p style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 1, letterSpacing: "0.04em" }}>
              PRACTICE OPERATING SYSTEM
            </p>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Nav — domain group → module → sub-pages, all config-driven */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", paddingRight: 2 }}>
          {CA_HUB_NAV_GROUPS.map((group) => (
            <SidebarNavGroup
              key={group.id}
              group={group}
              pathname={pathname}
              onNavigate={onClose}
            />
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          <Link
            href="/ca-hub/copilot"
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", gap: 8, textDecoration: "none",
              margin: "0 2px", padding: "10px 12px", borderRadius: 10,
              background: "linear-gradient(135deg, rgba(249,115,22,0.10), rgba(99,102,241,0.10))",
              border: "1px solid rgba(99,102,241,0.22)",
            }}
          >
            <Sparkles size={15} color="#f97316" />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-primary)" }}>AI CA Copilot</p>
              <p style={{ fontSize: 9.5, color: "var(--text-muted)" }}>Gemini · ask anything</p>
            </div>
          </Link>
          <Link
            href="/ca"
            onClick={onClose}
            className="sidebar-nav-item"
            style={{ fontSize: 12, color: "var(--text-muted)" }}
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            <span>Back to CA Portal</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
