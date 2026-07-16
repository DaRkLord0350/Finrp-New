import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExperianProvider } from "@/lib/credit/providers/experian.provider";
import { CIBILProvider } from "@/lib/credit/providers/cibil.provider";
import { CreditEndpointNotBoundError } from "@/lib/credit/types";
import { CreditConfigError } from "@/lib/credit/config";

const sampleInput = {
  organizationId: "org_test",
  subjectName: "Test Subject",
  pullType: "SOFT" as const,
  clientReference: "report_1",
};

describe("Bureau HTTP providers — no fabricated endpoints", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.EXPERIAN_BASE_URL = "https://example.invalid";
    process.env.EXPERIAN_CLIENT_ID = "test-client";
    process.env.EXPERIAN_API_KEY = "test-key";
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws CreditEndpointNotBoundError instead of guessing a real HTTP call", async () => {
    const provider = new ExperianProvider();
    await expect(provider.pullReport(sampleInput)).rejects.toThrow(CreditEndpointNotBoundError);
  });

  it("throws CreditConfigError when required env vars are missing, before attempting any call", async () => {
    const provider = new CIBILProvider(); // CIBIL_* vars intentionally not set
    await expect(provider.pullReport(sampleInput)).rejects.toThrow(CreditConfigError);
  });

  it("each bureau reports its own identity", () => {
    expect(new ExperianProvider().bureau).toBe("EXPERIAN");
    expect(new CIBILProvider().bureau).toBe("CIBIL");
    expect(new ExperianProvider().name).toBe("EXPERIAN_HTTP");
  });
});
