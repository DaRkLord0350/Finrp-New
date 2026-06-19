// ============================================================
// Budget period helpers — client-safe (no prisma).
// Maps a budget's granularity + fiscal-year start to period buckets.
// ============================================================

export type BudgetGranularity = "MONTHLY" | "QUARTERLY" | "YEARLY";

export function periodCount(granularity: BudgetGranularity): number {
  return granularity === "MONTHLY" ? 12 : granularity === "QUARTERLY" ? 4 : 1;
}

export function periodLabels(granularity: BudgetGranularity, fyStart: Date | string): string[] {
  const start = new Date(fyStart);
  if (granularity === "YEARLY") return ["Full Year"];
  if (granularity === "QUARTERLY") return ["Q1", "Q2", "Q3", "Q4"];
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  });
}

/** Map a posting date to a 0-based period index within the fiscal year. */
export function dateToPeriodIndex(date: Date, fyStart: Date, granularity: BudgetGranularity): number {
  if (granularity === "YEARLY") return 0;
  const months = (date.getFullYear() - fyStart.getFullYear()) * 12 + (date.getMonth() - fyStart.getMonth());
  if (granularity === "QUARTERLY") return Math.min(3, Math.max(0, Math.floor(months / 3)));
  return Math.min(11, Math.max(0, months));
}
