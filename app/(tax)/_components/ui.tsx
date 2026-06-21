"use client";

// ============================================================
// Shared client UI primitives for the Tax & Compliance Engine.
// ============================================================

import { cn } from "@/lib/utils";

export function formatINR(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(num);
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `GET ${url} failed`);
  return res.json();
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? `POST ${url} failed`);
  return json as T;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Generate the last `count` GST periods (MMYYYY) ending at May 2025 (demo) or now. */
export function recentPeriods(count = 12): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  // Anchor on May 2025 so the demo seed period is selectable by default.
  let m = 5;
  let y = 2025;
  for (let i = 0; i < count; i++) {
    out.push({ value: `${String(m).padStart(2, "0")}${y}`, label: `${MONTHS[m - 1]} ${y}` });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

export function PageHeader({ title, subtitle, icon, actions }: { title: string; subtitle?: string; icon?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">{icon}</div>}
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: React.ReactNode; hint?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const toneCls = {
    default: "text-foreground",
    good: "text-emerald-500",
    warn: "text-amber-500",
    bad: "text-red-500",
  }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold", toneCls)}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Btn({ children, onClick, variant = "primary", disabled, type = "button" }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean; type?: "button" | "submit" }) {
  const v = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    ghost: "border border-border bg-transparent hover:bg-muted",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50", v)}>
      {children}
    </button>
  );
}

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  READY: "bg-blue-500/15 text-blue-500",
  PENDING_APPROVAL: "bg-amber-500/15 text-amber-500",
  APPROVED: "bg-violet-500/15 text-violet-500",
  SUBMITTED: "bg-cyan-500/15 text-cyan-500",
  ACKNOWLEDGED: "bg-emerald-500/15 text-emerald-500",
  FAILED: "bg-red-500/15 text-red-500",
  REJECTED: "bg-red-500/15 text-red-500",
  MATCHED: "bg-emerald-500/15 text-emerald-500",
  PARTIAL: "bg-amber-500/15 text-amber-500",
  MISMATCH: "bg-red-500/15 text-red-500",
  MISSING_IN_2B: "bg-orange-500/15 text-orange-500",
  MISSING_IN_BOOKS: "bg-fuchsia-500/15 text-fuchsia-500",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_TONE[status] ?? "bg-muted text-muted-foreground")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function recentFYs(count = 4): string[] {
  const out: string[] = [];
  let start = 2025;
  for (let i = 0; i < count; i++) {
    out.push(`${start}-${String(start + 1).slice(-2)}`);
    start -= 1;
  }
  return out;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("rounded-md border border-border bg-background px-3 py-1.5 text-sm", props.className)} />;
}

export function NumInput({ value, onChange, placeholder }: { value: number | string; onChange: (n: number) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
    />
  );
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function FYSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={onChange} options={recentFYs().map((y) => ({ value: y, label: `FY ${y}` }))} />
  );
}

export function PeriodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
    >
      {recentPeriods().map((p) => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </select>
  );
}
