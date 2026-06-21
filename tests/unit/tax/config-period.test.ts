// ============================================================
// Unit tests — tax config registry + period helpers
// ============================================================

import { describe, it, expect } from "vitest";
import { fyToAy, ayToFy, getDefaultRuleSet, hasExactPack, latestFinancialYear } from "@/lib/tax/config/registry";
import {
  financialYearOf, assessmentYearOf, gstReturnPeriod, parseGstPeriod,
  nextGstPeriod, prevGstPeriod, makeGstPeriod, fyQuarterOf, stateCodeOfGstin,
} from "@/lib/tax/core/period";

describe("config registry", () => {
  it("converts FY ↔ AY", () => {
    expect(fyToAy("2025-26")).toBe("2026-27");
    expect(ayToFy("2026-27")).toBe("2025-26");
  });

  it("returns the FY 2025-26 default pack", () => {
    const pack = getDefaultRuleSet("2025-26");
    expect(pack.period).toBe("2025-26");
    expect(pack.gst.rateSlabs).toContain(18);
    expect(pack.gst.b2clThreshold).toBe(100000);
  });

  it("resolves a pack via AY axis", () => {
    const pack = getDefaultRuleSet("2026-27", "AY");
    expect(pack.period).toBe("2025-26");
  });

  it("falls back to the latest pack for an unknown year", () => {
    expect(hasExactPack("2099-00")).toBe(false);
    expect(getDefaultRuleSet("2099-00").period).toBe(latestFinancialYear());
  });
});

describe("period helpers", () => {
  it("derives the Indian financial year (Apr–Mar)", () => {
    expect(financialYearOf(new Date(Date.UTC(2025, 4, 10)))).toBe("2025-26"); // May 2025
    expect(financialYearOf(new Date(Date.UTC(2025, 2, 10)))).toBe("2024-25"); // Mar 2025
    expect(assessmentYearOf("2025-26")).toBe("2026-27");
  });

  it("builds + parses GST return periods (MMYYYY)", () => {
    expect(gstReturnPeriod(new Date(Date.UTC(2025, 4, 10)))).toBe("052025");
    expect(makeGstPeriod(5, 2025)).toBe("052025");
    const parsed = parseGstPeriod("052025");
    expect(parsed.month).toBe(5);
    expect(parsed.year).toBe(2025);
    expect(parsed.label).toBe("May 2025");
    expect(parsed.financialYear).toBe("2025-26");
  });

  it("rolls periods forward + back across year boundary", () => {
    expect(nextGstPeriod("122025")).toBe("012026");
    expect(prevGstPeriod("012026")).toBe("122025");
  });

  it("computes FY quarter + GSTIN state code", () => {
    expect(fyQuarterOf(new Date(Date.UTC(2025, 4, 1)))).toBe("Q1"); // May → Q1
    expect(fyQuarterOf(new Date(Date.UTC(2025, 0, 1)))).toBe("Q4"); // Jan → Q4
    expect(stateCodeOfGstin("27AAPFU0939F1ZV")).toBe("27");
    expect(stateCodeOfGstin(null)).toBeNull();
  });

  it("throws on malformed GST period", () => {
    expect(() => parseGstPeriod("2025")).toThrow();
    expect(() => parseGstPeriod("132025")).toThrow();
  });
});
