import { describe, it, expect } from "vitest";
import { issueChallenge, confirmChallenge, type OtpChallenge } from "@/lib/verification/otp/service";

describe("issueChallenge", () => {
  it("generates a 6-digit numeric code and a masked destination", () => {
    const { code, challenge } = issueChallenge("user@example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect(challenge.destination).toBe("us***@example.com");
    expect(challenge.attempts).toBe(0);
  });

  it("masks a phone number to its last 4 digits", () => {
    const { challenge } = issueChallenge("+919999912345");
    expect(challenge.destination).toBe("***2345");
  });

  it("never stores the raw code — only a hash", () => {
    const { code, challenge } = issueChallenge("+919999912345");
    expect(JSON.stringify(challenge)).not.toContain(code);
  });
});

describe("confirmChallenge", () => {
  it("returns VERIFIED for the correct code", () => {
    const { code, challenge } = issueChallenge("+919999912345");
    expect(confirmChallenge(challenge, code)).toBe("VERIFIED");
  });

  it("returns INCORRECT for a wrong code", () => {
    const { challenge } = issueChallenge("+919999912345");
    expect(confirmChallenge(challenge, "000000")).toBe("INCORRECT");
  });

  it("returns EXPIRED once past the expiry timestamp", () => {
    const { code, challenge } = issueChallenge("+919999912345");
    const expired: OtpChallenge = { ...challenge, expiresAt: new Date(Date.now() - 1000).toISOString() };
    expect(confirmChallenge(expired, code)).toBe("EXPIRED");
  });

  it("returns EXHAUSTED once attempts reach the cap, even with the correct code", () => {
    const { code, challenge } = issueChallenge("+919999912345");
    const exhausted: OtpChallenge = { ...challenge, attempts: 5 };
    expect(confirmChallenge(exhausted, code)).toBe("EXHAUSTED");
  });

  it("is resistant to a naive string-equality timing shortcut (different-length hashes never match)", () => {
    const { challenge } = issueChallenge("+919999912345");
    expect(confirmChallenge(challenge, "1")).toBe("INCORRECT");
  });
});
