// ============================================================
// lib/credit/providers/mock.provider.ts
// Deterministic fake bureau responses — mirrors lib/tbx/mock-provider.ts.
// Same subject (name+PAN) always yields the same score/tradelines, so
// tests and demos are reproducible. One class, parametrized by bureau,
// rather than four near-identical copies.
// ============================================================

import { createHash } from "crypto";
import type { Bureau } from "../config";
import type { CreditProvider, CreditTradelineData, PullCreditReportInput, PullCreditReportResult } from "../types";

const SCORE_MODEL: Record<Bureau, string> = {
  EXPERIAN: "Experian Credit Score",
  CIBIL: "CIBIL TransUnion Score",
  CRIF: "CRIF High Mark Score",
  EQUIFAX: "Equifax Risk Score",
};

function seedFrom(input: PullCreditReportInput): number {
  const hash = createHash("sha256").update(`${input.subjectName}|${input.pan ?? ""}`).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

export class MockCreditProvider implements CreditProvider {
  readonly name: string;
  readonly bureau: Bureau;

  constructor(bureau: Bureau) {
    this.bureau = bureau;
    this.name = `${bureau}_MOCK`;
  }

  async pullReport(input: PullCreditReportInput): Promise<PullCreditReportResult> {
    const seed = seedFrom(input);

    // Deterministic "always fail" test marker, same convention as
    // lib/lending/payments/mock-provider.ts.
    if (input.subjectName.includes("FAILTEST")) {
      return { outcome: "FAILED", tradelines: [], enquiries: [], raw: { mock: true }, failureReason: "Mock forced failure" };
    }

    const score = 300 + (seed % 601); // 300-900, CIBIL-style range
    const tradelineCount = seed % 4; // 0-3 tradelines
    const tradelines: CreditTradelineData[] = Array.from({ length: tradelineCount }, (_, i) => ({
      lenderName: ["HDFC Bank", "ICICI Bank", "Bajaj Finance", "SBI Card"][(seed + i) % 4],
      accountType: ["Personal Loan", "Credit Card", "Auto Loan", "Business Loan"][(seed + i) % 4],
      ownership: "INDIVIDUAL",
      status: (seed + i) % 5 === 0 ? "DEFAULT" : "ACTIVE",
      sanctionedAmount: 50_000 + ((seed + i) % 20) * 25_000,
      currentBalance: 10_000 + ((seed + i) % 15) * 10_000,
      overdueAmount: (seed + i) % 5 === 0 ? 5000 : 0,
      dpd: (seed + i) % 5 === 0 ? 45 : 0,
      openedDate: new Date(Date.now() - (365 + i * 100) * 86_400_000).toISOString().slice(0, 10),
    }));

    const enquiryCount = seed % 3;
    const enquiries = Array.from({ length: enquiryCount }, (_, i) => ({
      enquiringInstitution: ["Axis Bank", "Kotak Mahindra", "IDFC First"][(seed + i) % 3],
      enquiryPurpose: "Loan Application",
      enquiryDate: new Date(Date.now() - (10 + i * 30) * 86_400_000).toISOString().slice(0, 10),
      amount: 100_000 + ((seed + i) % 10) * 50_000,
    }));

    return {
      outcome: "SUCCESS",
      referenceId: `${this.bureau.toLowerCase()}_${createHash("sha256").update(input.clientReference).digest("hex").slice(0, 12)}`,
      score,
      scoreModel: SCORE_MODEL[this.bureau],
      scoreDate: new Date().toISOString().slice(0, 10),
      tradelines,
      enquiries,
      raw: { mock: true, bureau: this.bureau, subjectName: input.subjectName },
    };
  }
}
