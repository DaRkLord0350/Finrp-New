// ============================================================
// lib/tax/config/packs/fy-2025-26.ts
//
// Default code rule-pack for Financial Year 2025-26 (AY 2026-27).
// These are the DEFAULTS; a PUBLISHED TaxConfigVersion row can
// override any subset at runtime (see loader.ts).
//
// Sources: CGST/IGST Acts + rate notifications, Income-tax Act
// Finance Act 2024/2025, CBDT depreciation schedules, CII table.
// Values are configuration data, intentionally NOT inlined anywhere
// else in the codebase.
// ============================================================

import type { TaxRuleSet } from "../types";

export const FY_2025_26: TaxRuleSet = {
  period: "2025-26",
  axis: "FY",

  gst: {
    rateSlabs: [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28],
    cessSlabs: [0, 1, 3, 12, 15, 17, 22, 36, 60, 65, 71, 96, 142, 160, 204, 290],
    b2clThreshold: 100000, // ₹1,00,000 (inter-state B2C large)
    hsnDigitsByTurnover: [
      { upToCrore: 5, digits: 4 },
      { upToCrore: Number.POSITIVE_INFINITY, digits: 6 },
    ],
    lateFeePerDay: { nil: 20, normal: 50, maxCap: 10000 },
    interestRatePct: 18,
    dueDates: {
      gstr1Monthly: 11,
      gstr1Quarterly: 13,
      gstr3bMonthly: 20,
      gstr3bQrmp: 22,
    },
  },

  tds: {
    sections: [
      { code: "192", name: "Salary", rateIndividual: 0, rateOther: 0, rateNoPan: 20, thresholdSingle: 0, thresholdAnnual: 0 },
      { code: "194A", name: "Interest other than securities", rateIndividual: 10, rateOther: 10, rateNoPan: 20, thresholdSingle: 0, thresholdAnnual: 40000 },
      { code: "194C", name: "Payment to contractors", rateIndividual: 1, rateOther: 2, rateNoPan: 20, thresholdSingle: 30000, thresholdAnnual: 100000 },
      { code: "194H", name: "Commission or brokerage", rateIndividual: 2, rateOther: 2, rateNoPan: 20, thresholdSingle: 0, thresholdAnnual: 20000 },
      { code: "194I", name: "Rent of plant/machinery/land/building", rateIndividual: 10, rateOther: 10, rateNoPan: 20, thresholdSingle: 0, thresholdAnnual: 240000 },
      { code: "194J", name: "Professional/technical fees", rateIndividual: 10, rateOther: 10, rateNoPan: 20, thresholdSingle: 0, thresholdAnnual: 30000 },
      { code: "194Q", name: "Purchase of goods", rateIndividual: 0.1, rateOther: 0.1, rateNoPan: 5, thresholdSingle: 0, thresholdAnnual: 5000000 },
      { code: "206C(1H)", name: "TCS on sale of goods", rateIndividual: 0.1, rateOther: 0.1, rateNoPan: 1, thresholdSingle: 0, thresholdAnnual: 5000000 },
    ],
    interest: { lateDeductionPct: 1, lateDepositPct: 1.5 },
    dueDates: {
      challanDay: 7, // 7th of next month
      returnByQuarter: { Q1: "07-31", Q2: "10-31", Q3: "01-31", Q4: "05-31" },
    },
  },

  incomeTax: {
    // Old regime (individual < 60)
    oldRegimeSlabs: [
      { upTo: 250000, ratePct: 0 },
      { upTo: 500000, ratePct: 5 },
      { upTo: 1000000, ratePct: 20 },
      { upTo: null, ratePct: 30 },
    ],
    // New regime u/s 115BAC (FY 2025-26)
    newRegimeSlabs: [
      { upTo: 400000, ratePct: 0 },
      { upTo: 800000, ratePct: 5 },
      { upTo: 1200000, ratePct: 10 },
      { upTo: 1600000, ratePct: 15 },
      { upTo: 2000000, ratePct: 20 },
      { upTo: 2400000, ratePct: 25 },
      { upTo: null, ratePct: 30 },
    ],
    surcharge: [
      { aboveIncome: 5000000, ratePct: 10 },
      { aboveIncome: 10000000, ratePct: 15 },
      { aboveIncome: 20000000, ratePct: 25 },
      // 37% slab removed under new regime; capped at 25%
    ],
    cessPct: 4,
    rebate87A: { oldLimit: 500000, newLimit: 1200000, maxRebateOld: 12500, maxRebateNew: 60000 },
    standardDeduction: { salaried: 75000 },
    deductionLimits: {
      "80C": 150000,
      "80CCD1B": 50000,
      "80D": 25000,
      "80D_SENIOR": 50000,
      "80G": Number.POSITIVE_INFINITY,
      "80TTA": 10000,
      "80TTB": 50000,
    },
  },

  depreciation: {
    itActBlocks: {
      "Building (residential)": 5,
      "Building (general)": 10,
      "Furniture & fittings": 10,
      "Plant & machinery (general)": 15,
      "Motor vehicles": 15,
      "Computers & software": 40,
      "Intangible assets": 25,
    },
    companiesActBlocks: {
      "Building (general)": 3.17,
      "Plant & machinery (general)": 6.33,
      "Furniture & fittings": 9.5,
      "Computers": 31.67,
      "Vehicles": 11.88,
    },
  },

  capitalGains: {
    cii: {
      "2001-02": 100,
      "2017-18": 272,
      "2018-19": 280,
      "2019-20": 289,
      "2020-21": 301,
      "2021-22": 317,
      "2022-23": 331,
      "2023-24": 348,
      "2024-25": 363,
      "2025-26": 376,
    },
    ltcgEquityRatePct: 12.5, // post-23-Jul-2024
    ltcgEquityExemption: 125000, // ₹1.25L u/s 112A
    stcgEquityRatePct: 20, // post-23-Jul-2024
    ltcgOtherRatePct: 12.5, // without indexation (new regime)
  },

  dueDates: {
    itrFilingNonAudit: "07-31",
    itrFilingAudit: "10-31",
    taxAuditReport: "09-30",
    advanceTaxInstallments: [
      { day: 15, month: 6, cumulativePct: 15 },
      { day: 15, month: 9, cumulativePct: 45 },
      { day: 15, month: 12, cumulativePct: 75 },
      { day: 15, month: 3, cumulativePct: 100 },
    ],
  },
};
