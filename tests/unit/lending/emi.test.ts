import { describe, it, expect } from "vitest";
import {
  calculateReducingBalanceEMI,
  calculateFlatRateEMI,
  generateAmortizationSchedule,
  calculateSimpleInterest,
  calculateForeclosurePayoff,
  recomputeScheduleAfterPartPayment,
} from "@/lib/lending/core/emi";
import { toNumber } from "@/lib/lending/core/money";

describe("calculateReducingBalanceEMI", () => {
  it("matches the standard amortization formula for a textbook case", () => {
    // P=100000, annual rate=12%, n=12 months -> known EMI ~= 8884.88
    const emi = calculateReducingBalanceEMI(100_000, 12, 12);
    expect(toNumber(emi)).toBeCloseTo(8884.88, 1);
  });

  it("falls back to a straight-line split at 0% interest", () => {
    const emi = calculateReducingBalanceEMI(120_000, 0, 12);
    expect(toNumber(emi)).toBe(10_000);
  });

  it("throws for non-positive tenure", () => {
    expect(() => calculateReducingBalanceEMI(1000, 10, 0)).toThrow();
  });
});

describe("calculateFlatRateEMI", () => {
  it("computes total-interest / tenure evenly", () => {
    // P=100000, 12% flat over 12 months -> interest = 100000*0.12*1 = 12000, EMI = 112000/12
    const emi = calculateFlatRateEMI(100_000, 12, 12);
    expect(toNumber(emi)).toBeCloseTo(112_000 / 12, 1);
  });
});

describe("generateAmortizationSchedule — reducing balance", () => {
  const schedule = generateAmortizationSchedule(100_000, 12, 12, "REDUCING_BALANCE", new Date("2026-01-01"));

  it("produces one row per installment, in order", () => {
    expect(schedule).toHaveLength(12);
    expect(schedule.map((r) => r.installmentNumber)).toEqual([...Array(12)].map((_, i) => i + 1));
  });

  it("reconciles: cumulative principal repaid equals the original principal exactly", () => {
    const totalPrincipal = schedule.reduce((sum, r) => sum + toNumber(r.principalDue), 0);
    expect(totalPrincipal).toBeCloseTo(100_000, 2);
  });

  it("lands on exactly zero outstanding principal after the final installment", () => {
    expect(toNumber(schedule[schedule.length - 1].outstandingPrincipal)).toBe(0);
  });

  it("decreases the interest portion over time as principal reduces (reducing balance behavior)", () => {
    expect(toNumber(schedule[0].interestDue)).toBeGreaterThan(toNumber(schedule[schedule.length - 1].interestDue));
  });

  it("advances due dates monthly from the given start date", () => {
    expect(schedule[0].dueDate.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(schedule[1].dueDate.getMonth()).toBe((schedule[0].dueDate.getMonth() + 1) % 12);
  });
});

describe("generateAmortizationSchedule — flat rate", () => {
  const schedule = generateAmortizationSchedule(60_000, 10, 6, "FLAT", new Date("2026-01-01"));

  it("keeps the interest portion constant across installments (flat-rate behavior)", () => {
    const interestValues = schedule.slice(0, -1).map((r) => toNumber(r.interestDue));
    expect(new Set(interestValues.map((v) => v.toFixed(2))).size).toBe(1);
  });

  it("still reconciles principal to the original amount", () => {
    const totalPrincipal = schedule.reduce((sum, r) => sum + toNumber(r.principalDue), 0);
    expect(totalPrincipal).toBeCloseTo(60_000, 2);
  });
});

describe("calculateSimpleInterest", () => {
  it("computes daily simple interest on a utilized balance", () => {
    // 100000 at 12% p.a. for 30 days = 100000 * 0.12 * 30/365
    const interest = calculateSimpleInterest(100_000, 12, 30);
    expect(toNumber(interest)).toBeCloseTo((100_000 * 0.12 * 30) / 365, 1);
  });

  it("rejects negative day counts", () => {
    expect(() => calculateSimpleInterest(1000, 10, -1)).toThrow();
  });
});

describe("calculateForeclosurePayoff", () => {
  it("adds the foreclosure charge to outstanding principal", () => {
    const { foreclosureAmount, charges } = calculateForeclosurePayoff(50_000, 2);
    expect(toNumber(charges)).toBeCloseTo(1000, 2);
    expect(toNumber(foreclosureAmount)).toBeCloseTo(51_000, 2);
  });

  it("waives charges when requested", () => {
    const { foreclosureAmount, charges } = calculateForeclosurePayoff(50_000, 2, true);
    expect(toNumber(charges)).toBe(0);
    expect(toNumber(foreclosureAmount)).toBe(50_000);
  });
});

describe("recomputeScheduleAfterPartPayment", () => {
  it("re-amortizes from the new outstanding principal over the remaining tenure", () => {
    const schedule = recomputeScheduleAfterPartPayment(50_000, 12, 6, "REDUCING_BALANCE", new Date("2026-06-01"), 7);
    expect(schedule).toHaveLength(6);
    expect(schedule[0].installmentNumber).toBe(7);
    const totalPrincipal = schedule.reduce((sum, r) => sum + toNumber(r.principalDue), 0);
    expect(totalPrincipal).toBeCloseTo(50_000, 2);
  });
});
