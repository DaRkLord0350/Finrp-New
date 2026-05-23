// ============================================================
// lib/formatters/date.ts
// ============================================================

import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isYesterday,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  addDays,
  parseISO,
} from "date-fns";

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy, hh:mm a");
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isYesterday(d)) return "Yesterday";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatMonthYear(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM yyyy");
}

export function formatPeriod(date: Date | string): string {
  return format(new Date(date), "yyyy-MM");
}

export function getDaysOverdue(dueDate: Date | string): number {
  return Math.max(0, differenceInDays(new Date(), new Date(dueDate)));
}

export function getDaysUntilDue(dueDate: Date | string): number {
  return differenceInDays(new Date(dueDate), new Date());
}

export function isOverdue(dueDate: Date | string): boolean {
  return new Date(dueDate) < new Date();
}

export function getCurrentMonthRange() {
  const now = new Date();
  return { start: startOfMonth(now), end: endOfMonth(now) };
}

export function getCurrentYearRange() {
  const now = new Date();
  return { start: startOfYear(now), end: endOfYear(now) };
}

export function getLastNMonthsRange(n: number) {
  const now = new Date();
  return { start: startOfMonth(subMonths(now, n - 1)), end: endOfMonth(now) };
}

export function addBusinessDays(date: Date, days: number): Date {
  return addDays(date, days);
}

export function parseDate(dateStr: string): Date {
  return parseISO(dateStr);
}

export function getIndianFiscalYear(date = new Date()): { start: Date; end: Date; label: string } {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return {
    start: new Date(year, 3, 1),
    end: new Date(year + 1, 2, 31),
    label: `FY ${year}-${String(year + 1).slice(2)}`,
  };
}
