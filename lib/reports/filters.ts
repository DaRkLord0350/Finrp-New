// ============================================================
// Report Filters — date range resolvers and hash helpers
// ============================================================

import { createHash } from "crypto";
import type { DatePreset, ReportFilters } from "./types";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function resolveDateRange(filters: ReportFilters): DateRange {
  if (filters.startDate && filters.endDate) {
    return { startDate: filters.startDate, endDate: filters.endDate };
  }
  return getPresetRange(filters.datePreset ?? "this_month");
}

export function getPresetRange(preset: DatePreset): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (preset) {
    case "today":
      return {
        startDate: startOfDay(now),
        endDate:   endOfDay(now),
      };
    case "yesterday": {
      const yest = new Date(y, m, d - 1);
      return { startDate: startOfDay(yest), endDate: endOfDay(yest) };
    }
    case "this_week": {
      const day = now.getDay();
      const mon = new Date(y, m, d - ((day + 6) % 7));
      return { startDate: startOfDay(mon), endDate: endOfDay(now) };
    }
    case "last_week": {
      const day = now.getDay();
      const lastMon = new Date(y, m, d - ((day + 6) % 7) - 7);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastSun.getDate() + 6);
      return { startDate: startOfDay(lastMon), endDate: endOfDay(lastSun) };
    }
    case "this_month":
      return {
        startDate: new Date(y, m, 1),
        endDate:   endOfDay(new Date(y, m + 1, 0)),
      };
    case "last_month":
      return {
        startDate: new Date(y, m - 1, 1),
        endDate:   endOfDay(new Date(y, m, 0)),
      };
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return {
        startDate: new Date(y, q * 3, 1),
        endDate:   endOfDay(new Date(y, q * 3 + 3, 0)),
      };
    }
    case "last_quarter": {
      const q = Math.floor(m / 3) - 1;
      const qy = q < 0 ? y - 1 : y;
      const qa = ((q + 4) % 4);
      return {
        startDate: new Date(qy, qa * 3, 1),
        endDate:   endOfDay(new Date(qy, qa * 3 + 3, 0)),
      };
    }
    case "this_year":
      return {
        startDate: new Date(y, 0, 1),
        endDate:   endOfDay(new Date(y, 11, 31)),
      };
    case "last_year":
      return {
        startDate: new Date(y - 1, 0, 1),
        endDate:   endOfDay(new Date(y - 1, 11, 31)),
      };
    default:
      return {
        startDate: new Date(y, m, 1),
        endDate:   endOfDay(now),
      };
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function hashFilters(filters: ReportFilters): string {
  const normalized = {
    datePreset: filters.datePreset,
    startDate:  filters.startDate?.toISOString(),
    endDate:    filters.endDate?.toISOString(),
    customerId: filters.customerId,
    vendorId:   filters.vendorId,
    itemId:     filters.itemId,
    status:     filters.status,
    currency:   filters.currency,
    accountId:  filters.accountId,
  };
  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .substring(0, 16);
}

export function parseFiltersFromQuery(params: URLSearchParams): ReportFilters {
  const filters: ReportFilters = {};

  const preset = params.get("preset");
  if (preset) filters.datePreset = preset as DatePreset;

  const start = params.get("startDate");
  if (start) filters.startDate = new Date(start);

  const end = params.get("endDate");
  if (end) filters.endDate = new Date(end);

  const customerId = params.get("customerId");
  if (customerId) filters.customerId = customerId;

  const vendorId = params.get("vendorId");
  if (vendorId) filters.vendorId = vendorId;

  const itemId = params.get("itemId");
  if (itemId) filters.itemId = itemId;

  const status = params.get("status");
  if (status) filters.status = status;

  const currency = params.get("currency");
  if (currency) filters.currency = currency;

  const accountId = params.get("accountId");
  if (accountId) filters.accountId = accountId;

  return filters;
}
