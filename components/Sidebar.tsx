"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  X,
  Zap,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getVisibleSidebarItems, canAccessSidebarItem } from "@/lib/auth/sidebar";
import { sidebarNavItems, sidebarBottomItems, aiAdvisorBadge } from "@/constants/sidebar";
import type { SidebarItem } from "@/constants/sidebar";

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [visibleNavItems, setVisibleNavItems] = useState<SidebarItem[]>([]);
  const [visibleBottomItems, setVisibleBottomItems] = useState<SidebarItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVisibleItems() {
      try {
        const nav = await getVisibleSidebarItems(sidebarNavItems);
        const bottom = await getVisibleSidebarItems(sidebarBottomItems);
        setVisibleNavItems(nav);
        setVisibleBottomItems(bottom);
      } catch (error) {
        console.error("[Sidebar] Failed to load visible items:", error);
      } finally {
        setLoading(false);
      }
    }

    loadVisibleItems();
  }, []);

  if (loading) {
    return (
      <aside className="sidebar">
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
              flexShrink: 0,
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
      </aside>
    );
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={cn("sidebar", open && "sidebar--open")}>
        {/* Logo + mobile close button */}
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
              flexShrink: 0,
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
          {/* Close button — mobile only */}
          <button
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
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

          {visibleNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("sidebar-nav-item", isActive && "active")}
                onClick={onClose}
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
          {visibleBottomItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("sidebar-nav-item", isActive && "active")}
                onClick={onClose}
              >
                <Icon size={16} strokeWidth={1.75} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* AI Badge */}
          {aiAdvisorBadge.enabled && (
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
                  {aiAdvisorBadge.label}
                </p>
                <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {aiAdvisorBadge.description}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
