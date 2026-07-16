import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getCreditProvider, resetCreditProviderCache } from "@/lib/credit";

describe("getCreditProvider factory", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => resetCreditProviderCache());
  afterEach(() => {
    process.env = { ...originalEnv };
    resetCreditProviderCache();
  });

  it("selects the mock provider only for bureaus with their own MOCK_MODE flag set", () => {
    process.env.CIBIL_MOCK_MODE = "true";
    delete process.env.EXPERIAN_MOCK_MODE;
    process.env.EXPERIAN_BASE_URL = "https://example.invalid";
    process.env.EXPERIAN_CLIENT_ID = "id";
    process.env.EXPERIAN_API_KEY = "key";

    expect(getCreditProvider("CIBIL").name).toBe("CIBIL_MOCK");
    expect(getCreditProvider("EXPERIAN").name).toBe("EXPERIAN_HTTP");
  });

  it("caches per bureau independently", () => {
    process.env.CRIF_MOCK_MODE = "true";
    const a = getCreditProvider("CRIF");
    const b = getCreditProvider("CRIF");
    expect(a).toBe(b);
  });
});
