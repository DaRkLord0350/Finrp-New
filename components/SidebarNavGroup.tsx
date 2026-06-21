"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Lock, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { AppModule } from "@/lib/auth/rbac";
import type { Feature } from "@/lib/billing/features";

// ── Shared collapsible sidebar group (Banking OS accordion) ───
// The customer Sidebar, the CA portal CASidebar and the CA Hub
// CAHubSidebar all render their navigation from NavGroupConfig
// arrays through this component. Groups nest recursively, so a
// config item can itself be a group (module → sub-pages). New
// modules are added by configuration only.

export interface NavBadge {
  text: string;
  background: string;
  color: string;
}

export interface NavLeaf {
  label: string;
  href: string;
  /** RBAC module this item belongs to. When set and the user lacks
   *  access, the row renders locked (lock icon, non-clickable). */
  module?: AppModule;
  /** Plan entitlement this item needs. When set and the plan doesn't
   *  include it, the row renders as an "upgrade" lock (→ billing). */
  feature?: Feature;
  /** optional — deep sub-items render as text-only rows */
  icon?: LucideIcon;
  /** match only the exact href (for index routes with sibling children) */
  exact?: boolean;
  /** widens active matching beyond the href, e.g. "/accounting" */
  activePrefix?: string;
  /** renders a disabled "SOON" row until the page ships */
  comingSoon?: boolean;
  /** module accent — icon renders inside a tinted chip when active */
  accent?: string;
  badge?: NavBadge;
  /** tooltip */
  description?: string;
}

export interface NavGroupConfig {
  id: string;
  /** optional uppercase section heading rendered above the group (depth 0 only) */
  section?: string;
  label: string;
  /** RBAC module the whole group maps to (optional). When set and the
   *  user lacks access, the entire group renders locked. */
  module?: AppModule;
  /** Plan entitlement the whole group needs (optional). When the plan
   *  lacks it, the entire group renders as an "upgrade" lock. */
  feature?: Feature;
  icon: LucideIcon;
  badge?: NavBadge;
  /** paths beyond the child hrefs that count as "inside" the group (e.g. its index page) */
  basePath?: string;
  /** module accent — icon renders inside a tinted chip when active */
  accent?: string;
  /** tooltip */
  description?: string;
  items: NavItem[];
  /** optional trailing link, e.g. "View all →" */
  footer?: { label: string; href: string };
}

export type NavItem = NavLeaf | NavGroupConfig;

export function isNavGroup(item: NavItem): item is NavGroupConfig {
  return "items" in item;
}

export function isLeafActive(pathname: string, item: NavLeaf): boolean {
  if (item.comingSoon) return false;
  if (item.exact) return pathname === item.href;
  if (item.activePrefix) return pathname.startsWith(item.activePrefix);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function isGroupActive(pathname: string, group: NavGroupConfig): boolean {
  if (group.basePath && pathname.startsWith(group.basePath)) return true;
  return group.items.some((item) =>
    isNavGroup(item) ? isGroupActive(pathname, item) : isLeafActive(pathname, item)
  );
}

// ── Access gating ─────────────────────────────────────────────
// Two orthogonal gates:
//   • `canAccess(module)`  — RBAC role permission.
//   • `hasFeature(feature)`— plan entitlement.
// Untagged items are always reachable. An item is reachable only when
// BOTH gates pass. A failing RBAC gate renders a plain lock; a failing
// plan gate renders an "upgrade" lock that links to billing.
export type CanAccess = (module?: AppModule) => boolean;
export type HasFeature = (feature: Feature) => boolean;

const ALLOW_FEATURE: HasFeature = () => true;

/** Why a row is locked, or null when reachable. */
export type LockReason = "rbac" | "upgrade" | null;

export function leafLockReason(
  item: NavLeaf,
  canAccess: CanAccess,
  hasFeature: HasFeature = ALLOW_FEATURE
): LockReason {
  if (item.module && !canAccess(item.module)) return "rbac";
  if (item.feature && !hasFeature(item.feature)) return "upgrade";
  return null;
}

export function isLeafAccessible(
  item: NavLeaf,
  canAccess: CanAccess,
  hasFeature: HasFeature = ALLOW_FEATURE
): boolean {
  return leafLockReason(item, canAccess, hasFeature) === null;
}

export function isGroupAccessible(
  group: NavGroupConfig,
  canAccess: CanAccess,
  hasFeature: HasFeature = ALLOW_FEATURE
): boolean {
  // A group explicitly tied to a module/feature is locked regardless of
  // children.
  if (group.module && !canAccess(group.module)) return false;
  if (group.feature && !hasFeature(group.feature)) return false;
  // Otherwise the group is reachable if ANY descendant is reachable.
  return group.items.some((item) =>
    isNavGroup(item)
      ? isGroupAccessible(item, canAccess, hasFeature)
      : isLeafAccessible(item, canAccess, hasFeature)
  );
}

/** Why a whole group is locked, or null when reachable. */
export function groupLockReason(
  group: NavGroupConfig,
  canAccess: CanAccess,
  hasFeature: HasFeature = ALLOW_FEATURE
): LockReason {
  if (group.module && !canAccess(group.module)) return "rbac";
  if (group.feature && !hasFeature(group.feature)) return "upgrade";
  if (isGroupAccessible(group, canAccess, hasFeature)) return null;
  // No reachable descendants: prefer "rbac" unless every leaf is an
  // upgrade-only lock (then surface the upgrade affordance).
  return everyLeafUpgradeLocked(group, canAccess, hasFeature) ? "upgrade" : "rbac";
}

function everyLeafUpgradeLocked(
  group: NavGroupConfig,
  canAccess: CanAccess,
  hasFeature: HasFeature
): boolean {
  return group.items.every((item) =>
    isNavGroup(item)
      ? everyLeafUpgradeLocked(item, canAccess, hasFeature)
      : leafLockReason(item, canAccess, hasFeature) === "upgrade"
  );
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  padding: "8px 12px 4px",
};

const leafStyle: CSSProperties = { fontSize: 13, padding: "7px 10px" };

const labelStyle: CSSProperties = {
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const accentChipStyle = (active: boolean, accent: string): CSSProperties => ({
  width: 22,
  height: 22,
  borderRadius: 6,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: active ? `${accent}22` : "transparent",
});

function BadgePill({ badge }: { badge: NavBadge }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: badge.color,
        background: badge.background,
        padding: "1px 5px",
        borderRadius: 4,
        flexShrink: 0,
      }}
    >
      {badge.text}
    </span>
  );
}

function NavIcon({
  icon: Icon,
  accent,
  active,
  compact,
}: {
  icon?: LucideIcon;
  accent?: string;
  active: boolean;
  compact: boolean;
}) {
  if (!Icon) return null;
  if (accent) {
    return (
      <span style={accentChipStyle(active, accent)}>
        <Icon size={14} strokeWidth={1.9} color={active ? accent : "currentColor"} />
      </span>
    );
  }
  return <Icon size={compact ? 13 : 16} strokeWidth={1.75} />;
}

// Locked row with a lock icon — shown (not hidden) per product spec.
//   • "rbac"    → role can't access; non-clickable.
//   • "upgrade" → plan doesn't include it; clickable → billing/upgrade.
const UPGRADE_HREF = "/settings/billing";

function LockedRow({
  label,
  icon,
  compact,
  isGroup,
  reason = "rbac",
}: {
  label: string;
  icon?: LucideIcon;
  compact: boolean;
  isGroup?: boolean;
  reason?: "rbac" | "upgrade";
}) {
  const isUpgrade = reason === "upgrade";
  const baseStyle: CSSProperties = {
    ...(compact ? leafStyle : undefined),
    opacity: isUpgrade ? 0.7 : 0.45,
    cursor: isUpgrade ? "pointer" : "not-allowed",
    ...(isGroup ? { width: "100%", textAlign: "left" as const, marginTop: compact ? 0 : 4 } : {}),
  };

  const inner = (
    <>
      <NavIcon icon={icon} active={false} compact={compact} />
      <span style={labelStyle}>{label}</span>
      {isUpgrade && (
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "#818cf8",
            background: "rgba(99,102,241,0.15)",
            padding: "1px 5px",
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          PRO
        </span>
      )}
      <Lock size={12} style={{ flexShrink: 0, opacity: 0.7 }} />
    </>
  );

  if (isUpgrade) {
    return (
      <Link
        href={UPGRADE_HREF}
        className="sidebar-nav-item"
        title={`${label} isn't in your plan — upgrade to unlock`}
        style={baseStyle}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className="sidebar-nav-item"
      aria-disabled="true"
      title="You don't have access to this module"
      style={baseStyle}
    >
      {inner}
    </div>
  );
}

export function SidebarNavGroup({
  group,
  pathname,
  onNavigate,
  depth = 0,
  canAccess = () => true,
  hasFeature = ALLOW_FEATURE,
}: {
  group: NavGroupConfig;
  pathname: string;
  onNavigate?: () => void;
  /** 0 = top-level group; deeper levels render compact rows */
  depth?: number;
  /** RBAC permission predicate; defaults to "everything accessible" */
  canAccess?: CanAccess;
  /** plan entitlement predicate; defaults to "everything included" */
  hasFeature?: HasFeature;
}) {
  const isActive = isGroupActive(pathname, group);
  const [open, setOpen] = useState(isActive);

  // Auto-expand whenever navigation lands on a child route, while still
  // allowing manual toggle. Adjusting state during render (the documented
  // "store info from previous render" pattern) avoids an effect-driven
  // cascading render. See https://react.dev/reference/react/useState
  const [prevActive, setPrevActive] = useState(isActive);
  if (isActive !== prevActive) {
    setPrevActive(isActive);
    if (isActive) setOpen(true);
  }

  const compact = depth > 0;

  // Entire group inaccessible → show a locked, non-expandable header
  // (the module stays visible but is not clickable — no route exposed).
  const groupLock = groupLockReason(group, canAccess, hasFeature);
  if (groupLock) {
    return (
      <div style={{ marginTop: compact ? 0 : 4 }}>
        {depth === 0 && group.section && <p style={sectionTitleStyle}>{group.section}</p>}
        <LockedRow label={group.label} icon={group.icon} compact={compact} isGroup reason={groupLock} />
      </div>
    );
  }

  return (
    <div style={{ marginTop: compact ? 0 : 4 }}>
      {depth === 0 && group.section && <p style={sectionTitleStyle}>{group.section}</p>}

      <button
        className={cn("sidebar-nav-item", isActive && "active")}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={group.description}
        style={{ width: "100%", textAlign: "left", ...(compact ? leafStyle : undefined) }}
      >
        <NavIcon icon={group.icon} accent={group.accent} active={isActive} compact={compact} />
        <span style={labelStyle}>{group.label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {group.badge && <BadgePill badge={group.badge} />}
          <ChevronDown
            size={12}
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              opacity: 0.6,
            }}
          />
        </div>
      </button>

      {open && (
        <div
          style={{
            paddingLeft: compact ? 10 : 24,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            marginTop: 2,
            borderLeft: "1px solid var(--border)",
            marginLeft: compact ? 12 : 20,
          }}
        >
          {group.items.map((item) => {
            if (isNavGroup(item)) {
              return (
                <SidebarNavGroup
                  key={item.id}
                  group={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  depth={depth + 1}
                  canAccess={canAccess}
                  hasFeature={hasFeature}
                />
              );
            }

            // Locked leaf — RBAC ("rbac") or plan entitlement ("upgrade").
            const leafLock = leafLockReason(item, canAccess, hasFeature);
            if (leafLock) {
              return (
                <LockedRow key={item.href} label={item.label} icon={item.icon} compact reason={leafLock} />
              );
            }

            if (item.comingSoon) {
              return (
                <div
                  key={item.href}
                  className="sidebar-nav-item"
                  aria-disabled="true"
                  style={{ ...leafStyle, opacity: 0.45, cursor: "default" }}
                >
                  <NavIcon icon={item.icon} accent={item.accent} active={false} compact />
                  <span style={labelStyle}>{item.label}</span>
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color: "var(--text-muted)",
                      background: "rgba(148,163,184,0.15)",
                      padding: "1px 5px",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    SOON
                  </span>
                </div>
              );
            }

            const active = isLeafActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("sidebar-nav-item", active && "active")}
                onClick={onNavigate}
                title={item.description}
                style={leafStyle}
              >
                <NavIcon icon={item.icon} accent={item.accent} active={active} compact />
                <span style={labelStyle}>{item.label}</span>
                {item.badge && <BadgePill badge={item.badge} />}
              </Link>
            );
          })}
          {group.footer && (
            <Link
              href={group.footer.href}
              className="sidebar-nav-item"
              onClick={onNavigate}
              style={{ fontSize: 11, padding: "5px 10px", color: "var(--text-muted)" }}
            >
              {group.footer.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
