"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Scale, ArrowLeft, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CA_HUB_MODULES,
  CA_HUB_GROUPS,
  moduleHref,
  type ModuleStatus,
} from "@/lib/ca-hub/nav";

const STATUS_BADGE: Record<ModuleStatus, { label: string; color: string; bg: string }> = {
  live: { label: "LIVE", color: "#10b981", bg: "rgba(16,185,129,0.14)" },
  beta: { label: "BETA", color: "#818cf8", bg: "rgba(99,102,241,0.16)" },
  soon: { label: "SOON", color: "#a1a1aa", bg: "rgba(161,161,170,0.14)" },
};

interface Props {
  open?: boolean;
  onClose?: () => void;
}

export default function CAHubSidebar({ open = false, onClose }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/ca-hub" ? pathname === "/ca-hub" : pathname.startsWith(href);

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

        {/* Grouped nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", paddingRight: 2 }}>
          {CA_HUB_GROUPS.map((group) => {
            const mods = CA_HUB_MODULES.filter((m) => m.group === group);
            if (mods.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 4 }}>
                <p
                  style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: "0.09em",
                    textTransform: "uppercase", color: "var(--text-muted)",
                    padding: "8px 12px 4px",
                  }}
                >
                  {group}
                </p>
                {mods.map((m) => {
                  const href = moduleHref(m);
                  const active = isActive(href);
                  const Icon = m.icon;
                  const badge = STATUS_BADGE[m.status];
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={cn("sidebar-nav-item", active && "active")}
                      style={{ fontSize: 13, padding: "8px 10px" }}
                      title={m.description}
                    >
                      <span
                        style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: active ? `${m.accent}22` : "transparent",
                        }}
                      >
                        <Icon size={14} strokeWidth={1.9} color={active ? m.accent : "currentColor"} />
                      </span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.label}
                      </span>
                      {m.status !== "live" && (
                        <span
                          style={{
                            fontSize: 8.5, fontWeight: 800, letterSpacing: "0.04em",
                            color: badge.color, background: badge.bg,
                            padding: "1px 5px", borderRadius: 4, flexShrink: 0,
                          }}
                        >
                          {badge.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
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
