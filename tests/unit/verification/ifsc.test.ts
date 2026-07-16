import { describe, it, expect } from "vitest";
import { isValidIfscFormat } from "@/lib/verification/ifsc/service";
import { lookupIfsc } from "@/lib/verification/ifsc/service";
import { IfscFormatError } from "@/lib/verification/ifsc/types";

describe("isValidIfscFormat", () => {
  it("accepts a well-formed IFSC code", () => {
    expect(isValidIfscFormat("SBIN0020112")).toBe(true);
    expect(isValidIfscFormat("hdfc0001234")).toBe(true); // lowercase, normalized before matching
  });

  it("rejects codes that are the wrong length, missing the fixed 0, or contain invalid characters", () => {
    expect(isValidIfscFormat("SBIN020112")).toBe(false); // 10 chars
    expect(isValidIfscFormat("SBIN1020112")).toBe(false); // 5th char must be "0"
    expect(isValidIfscFormat("12340020112")).toBe(false); // first 4 must be letters
    expect(isValidIfscFormat("")).toBe(false);
  });
});

describe("lookupIfsc", () => {
  it("throws IfscFormatError before making any network call for a malformed code", async () => {
    await expect(lookupIfsc("NOT-A-CODE")).rejects.toBeInstanceOf(IfscFormatError);
  });
});
