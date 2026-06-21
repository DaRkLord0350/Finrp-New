// ============================================================
// lib/tax/core/period.ts
//
// Indian Financial Year / Assessment Year / GST return-period helpers.
// The Indian FY runs 1-Apr → 31-Mar. GST returns are keyed by the
// government "MMYYYY" period (e.g. "052025" = May 2025).
// ============================================================

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Financial year of a date, e.g. 2025-05-10 → "2025-26". */
export function financialYearOf(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0-based
  const startYear = m >= 3 ? y : y - 1; // Apr(3) onwards belongs to that FY
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/** Assessment year for a financial year, "2025-26" → "2026-27". */
export function assessmentYearOf(fy: string): string {
  const [s] = fy.split("-");
  const startYear = parseInt(s, 10) + 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/** GST government return period "MMYYYY" from a date. */
export function gstReturnPeriod(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${mm}${date.getUTCFullYear()}`;
}

/** Build a GST period from explicit month (1-12) + year. */
export function makeGstPeriod(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}${year}`;
}

export interface ParsedGstPeriod {
  month: number; // 1-12
  year: number;
  label: string; // "May 2025"
  financialYear: string; // "2025-26"
}

/** Parse a GST "MMYYYY" period into its parts. Throws on malformed input. */
export function parseGstPeriod(period: string): ParsedGstPeriod {
  if (!/^\d{6}$/.test(period)) {
    throw new Error(`Invalid GST period "${period}" (expected MMYYYY)`);
  }
  const month = parseInt(period.slice(0, 2), 10);
  const year = parseInt(period.slice(2), 10);
  if (month < 1 || month > 12) throw new Error(`Invalid month in GST period "${period}"`);
  const ref = new Date(Date.UTC(year, month - 1, 1));
  return {
    month,
    year,
    label: `${MONTHS[month - 1]} ${year}`,
    financialYear: financialYearOf(ref),
  };
}

/** Human label for a GST period, e.g. "052025" → "May 2025". */
export function gstPeriodLabel(period: string): string {
  try {
    return parseGstPeriod(period).label;
  } catch {
    return period;
  }
}

/** The GST period immediately following the given one. */
export function nextGstPeriod(period: string): string {
  const { month, year } = parseGstPeriod(period);
  return month === 12 ? makeGstPeriod(1, year + 1) : makeGstPeriod(month + 1, year);
}

/** The GST period immediately preceding the given one. */
export function prevGstPeriod(period: string): string {
  const { month, year } = parseGstPeriod(period);
  return month === 1 ? makeGstPeriod(12, year - 1) : makeGstPeriod(month - 1, year);
}

/** Quarter label ("Q1".."Q4") for an FY-relative date (Q1 = Apr-Jun). */
export function fyQuarterOf(date: Date): string {
  const m = date.getUTCMonth(); // 0-based
  const fyMonthIndex = (m - 3 + 12) % 12; // Apr → 0
  return `Q${Math.floor(fyMonthIndex / 3) + 1}`;
}

/** State code (first 2 chars) from a GSTIN. */
export function stateCodeOfGstin(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  return gstin.slice(0, 2);
}
