// ============================================================
// components/ca-hub/ui.tsx
// Presentational kit for CA Hub. Pure components (no hooks) so they
// work in both server and client pages. Matches the FinRP design
// system (CSS variables + inline styles, 12px radii, var(--bg-card)).
// ============================================================

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight, ArrowRight, CheckCircle2, Clock, Sparkles } from "lucide-react";
import {
  getModuleBySlug,
  type CaHubModule,
  type ModuleStatus,
} from "@/lib/ca-hub/nav";
import { FILING_TOKENS, RISK_TOKENS, type FilingState, type RiskLevel } from "@/lib/ca-hub/demo-data";

const STATUS_BADGE: Record<ModuleStatus, { label: string; color: string; bg: string }> = {
  live: { label: "Live", color: "#10b981", bg: "rgba(16,185,129,0.14)" },
  beta: { label: "Beta", color: "#818cf8", bg: "rgba(99,102,241,0.16)" },
  soon: { label: "On Roadmap", color: "#a1a1aa", bg: "rgba(161,161,170,0.14)" },
};

// ── Page header ────────────────────────────────────────────
export function PageHeader({
  title, subtitle, icon: Icon, accent = "#6366f1", actions,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        {Icon && (
          <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={21} color={accent} strokeWidth={2} />
          </div>
        )}
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────
export function Kpi({
  label, value, icon: Icon, accent = "#6366f1", sub, change, changeLabel,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: string;
  sub?: string;
  change?: number;
  changeLabel?: string;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
        {Icon && (
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={14} color={accent} strokeWidth={2} />
          </div>
        )}
      </div>
      <p style={{ fontSize: 23, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{sub}</p>}
      {change !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {positive ? <ArrowUpRight size={12} color="#10b981" /> : <ArrowDownRight size={12} color="#ef4444" />}
          <span style={{ fontSize: 11, fontWeight: 700, color: positive ? "#10b981" : "#ef4444" }}>{Math.abs(change).toFixed(1)}%</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{changeLabel ?? "vs last month"}</span>
        </div>
      )}
    </div>
  );
}

// ── Section panel ──────────────────────────────────────────
export function Panel({
  title, subtitle, action, children, style,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, ...style }}>
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
          <div>
            {title && <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Status pills ───────────────────────────────────────────
export function FilingPill({ state, size = 11 }: { state: FilingState; size?: number }) {
  const t = FILING_TOKENS[state];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: size, fontWeight: 700, color: t.color, background: t.bg, padding: "2px 9px", borderRadius: 999, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
      {t.label}
    </span>
  );
}

export function RiskPill({ level, size = 11 }: { level: RiskLevel; size?: number }) {
  const t = RISK_TOKENS[level];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: size, fontWeight: 700, color: t.color, background: t.bg, padding: "2px 9px", borderRadius: 999 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.color }} />
      {t.label}
    </span>
  );
}

// ── Generic tag/badge ──────────────────────────────────────
export function Tag({ label, color = "#818cf8" }: { label: string; color?: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}1f`, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.03em" }}>
      {label}
    </span>
  );
}

// ── Tiny horizontal progress ───────────────────────────────
export function MiniProgress({ value, color = "#6366f1", track = "var(--border)", height = 6 }: { value: number; color?: string; track?: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: height, background: track, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, value))}%`, background: color, borderRadius: height }} />
    </div>
  );
}

// ── Button helpers (visual only) ───────────────────────────
export function PrimaryButton({ children, icon: Icon, href, onClick }: { children: React.ReactNode; icon?: LucideIcon; href?: string; onClick?: () => void }) {
  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600,
    padding: "8px 15px", borderRadius: 9, border: "none", cursor: "pointer",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", textDecoration: "none",
    boxShadow: "0 2px 10px rgba(99,102,241,0.30)",
  };
  const content = <>{Icon && <Icon size={14} />}{children}</>;
  return href ? <Link href={href} style={style}>{content}</Link> : <button onClick={onClick} style={style}>{content}</button>;
}

export function GhostButton({ children, icon: Icon, href, onClick }: { children: React.ReactNode; icon?: LucideIcon; href?: string; onClick?: () => void }) {
  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 500,
    padding: "8px 14px", borderRadius: 9, border: "1px solid var(--border)", cursor: "pointer",
    background: "var(--bg-card)", color: "var(--text-primary)", textDecoration: "none",
  };
  const content = <>{Icon && <Icon size={14} />}{children}</>;
  return href ? <Link href={href} style={style}>{content}</Link> : <button onClick={onClick} style={style}>{content}</button>;
}

// ── Module status badge ────────────────────────────────────
export function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  const b = STATUS_BADGE[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: b.color, background: b.bg, padding: "3px 10px", borderRadius: 999, letterSpacing: "0.02em" }}>
      {b.label}
    </span>
  );
}

// ── Feature grid (mod.items → cards) ────────────────────
export function FeatureGrid({ mod }: { mod: CaHubModule }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
      {mod.items.map((it) => (
        <div key={it.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "15px 16px", display: "flex", flexDirection: "column", gap: 6, transition: "border-color 0.15s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: `${mod.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CheckCircle2 size={15} color={mod.accent} />
            </span>
            <ArrowRight size={14} color="var(--text-muted)" />
          </div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{it.label}</p>
          {it.blurb && <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{it.blurb}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Module landing template (used by lighter mods) ──────
export function ModuleLanding({
  slug,
  kpis,
  children,
  roadmap,
}: {
  slug: string;
  kpis?: React.ReactNode;
  children?: React.ReactNode;
  roadmap?: string[];
}) {
  const mod = getModuleBySlug(slug);
  if (!mod) return null;
  const Icon = mod.icon;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
      {/* Hero */}
      <div
        style={{
          background: `linear-gradient(135deg, ${mod.accent}14, transparent 70%)`,
          border: "1px solid var(--border)", borderRadius: 16, padding: 24,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", maxWidth: 640 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, flexShrink: 0, background: `${mod.accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={26} color={mod.accent} strokeWidth={2} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 23, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{mod.label}</h1>
              <ModuleStatusBadge status={mod.status} />
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{mod.description}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <GhostButton href="/ca-hub" icon={ArrowRight}>Back to dashboard</GhostButton>
        </div>
      </div>

      {/* Optional KPIs */}
      {kpis}

      {/* Custom body OR feature grid */}
      {children ?? (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>What&apos;s inside</h2>
          <FeatureGrid mod={mod} />
        </div>
      )}

      {/* Roadmap strip */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Sparkles size={15} color={mod.accent} />
          <h3 style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>Implementation roadmap</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(roadmap ?? [
            "Wire the dedicated Prisma models (already in schema) to the repository + API layer.",
            "Replace demo data with tenant-scoped queries (firmId / organizationId).",
            "Add create / edit / bulk-action flows with optimistic UI + BullMQ jobs.",
            "Layer real-time notifications and audit logging on every mutation.",
          ]).map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1, background: `${mod.accent}22`, color: mod.accent, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Section heading (in-page) ──────────────────────────────
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{children}</h2>
      {action}
    </div>
  );
}

// ── "time ago / days" helper for due dates ─────────────────
export function DueChip({ days }: { days: number }) {
  let color = "#10b981";
  let label = `in ${days}d`;
  if (days < 0) { color = "#ef4444"; label = `${Math.abs(days)}d overdue`; }
  else if (days === 0) { color = "#ef4444"; label = "Due today"; }
  else if (days <= 3) { color = "#f59e0b"; }
  else if (days <= 7) { color = "#f59e0b"; }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color, background: `${color}18`, padding: "2px 8px", borderRadius: 999 }}>
      <Clock size={10} />{label}
    </span>
  );
}
