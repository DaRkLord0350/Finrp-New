import { describe, it, expect } from "vitest";
import { MockCreditProvider } from "@/lib/credit/providers/mock.provider";
import type { PullCreditReportInput } from "@/lib/credit/types";

const baseInput: PullCreditReportInput = {
  organizationId: "org_test",
  subjectName: "Ravi Kumar",
  pan: "ABCDE1234F",
  pullType: "SOFT",
  clientReference: "report_1",
};

describe("MockCreditProvider", () => {
  it("is deterministic — same subject (name+PAN) always yields the same score", async () => {
    const provider = new MockCreditProvider("CIBIL");
    const first = await provider.pullReport(baseInput);
    const second = await provider.pullReport(baseInput);
    expect(first.score).toBe(second.score);
    expect(first.referenceId).toBe(second.referenceId);
  });

  it("returns a score within the 300-900 bureau range", async () => {
    const provider = new MockCreditProvider("EXPERIAN");
    const result = await provider.pullReport(baseInput);
    expect(result.score).toBeGreaterThanOrEqual(300);
    expect(result.score).toBeLessThanOrEqual(900);
  });

  it("tags the reference id and score model with the requesting bureau", async () => {
    const cibil = await new MockCreditProvider("CIBIL").pullReport(baseInput);
    const experian = await new MockCreditProvider("EXPERIAN").pullReport(baseInput);
    expect(cibil.referenceId).toMatch(/^cibil_/);
    expect(experian.referenceId).toMatch(/^experian_/);
    expect(cibil.scoreModel).not.toBe(experian.scoreModel);
  });

  it("honors the FAILTEST marker for deterministic failure-path testing", async () => {
    const provider = new MockCreditProvider("CRIF");
    const result = await provider.pullReport({ ...baseInput, subjectName: "FAILTEST Subject" });
    expect(result.outcome).toBe("FAILED");
    expect(result.failureReason).toBeTruthy();
  });

  it("different subjects yield different scores (not a constant)", async () => {
    const provider = new MockCreditProvider("EQUIFAX");
    const a = await provider.pullReport({ ...baseInput, subjectName: "Alice", pan: "AAAAA0000A", clientReference: "r_a" });
    const b = await provider.pullReport({ ...baseInput, subjectName: "Bob", pan: "BBBBB1111B", clientReference: "r_b" });
    expect(a.score).not.toBe(b.score);
  });
});
