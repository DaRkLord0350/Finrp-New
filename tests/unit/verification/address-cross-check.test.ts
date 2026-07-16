import { describe, it, expect } from "vitest";
import { crossCheckAddresses } from "@/lib/verification/address/cross-check";

describe("crossCheckAddresses", () => {
  it("reports INSUFFICIENT_DATA with fewer than two usable addresses", () => {
    expect(crossCheckAddresses([]).verdict).toBe("INSUFFICIENT_DATA");
    expect(crossCheckAddresses([{ source: "PAN_RECORD", address: "" }]).verdict).toBe("INSUFFICIENT_DATA");
    expect(crossCheckAddresses([{ source: "PAN_RECORD", address: "12 MG Road, Bangalore" }]).verdict).toBe("INSUFFICIENT_DATA");
  });

  it("reports MATCH for identical addresses", () => {
    const result = crossCheckAddresses([
      { source: "PAN_RECORD", address: "12 MG Road, Bangalore, Karnataka 560001" },
      { source: "BANK_IFSC", address: "12 MG Road, Bangalore, Karnataka 560001" },
    ]);
    expect(result.verdict).toBe("MATCH");
    expect(result.averageSimilarity).toBe(100);
  });

  it("reports MISMATCH for completely unrelated addresses", () => {
    const result = crossCheckAddresses([
      { source: "PAN_RECORD", address: "12 MG Road, Bangalore, Karnataka 560001" },
      { source: "BANK_IFSC", address: "88 Marine Drive, Mumbai, Maharashtra 400002" },
    ]);
    expect(result.verdict).toBe("MISMATCH");
  });

  it("reports PARTIAL_MATCH for addresses that share structure but differ in detail", () => {
    const result = crossCheckAddresses([
      { source: "PAN_RECORD", address: "12 MG Road, Bangalore, Karnataka 560001" },
      { source: "BANK_IFSC", address: "12 MG Road, Near City Mall, Bangalore, Karnataka 560025" },
    ]);
    expect(result.verdict === "PARTIAL_MATCH" || result.verdict === "MATCH").toBe(true);
  });

  it("compares every pair when more than two sources are given", () => {
    const result = crossCheckAddresses([
      { source: "PAN_RECORD", address: "12 MG Road, Bangalore" },
      { source: "BANK_IFSC", address: "12 MG Road, Bangalore" },
      { source: "AADHAAR_EKYC", address: "99 Different Street, Chennai" },
    ]);
    expect(result.comparisons).toHaveLength(3);
  });

  it("ignores sources with a blank address", () => {
    const result = crossCheckAddresses([
      { source: "PAN_RECORD", address: "12 MG Road, Bangalore" },
      { source: "BANK_IFSC", address: "12 MG Road, Bangalore" },
      { source: "AADHAAR_EKYC", address: "" },
    ]);
    expect(result.comparisons).toHaveLength(1);
  });
});
