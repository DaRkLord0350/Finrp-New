// ============================================================
// Unit tests — lib/banking/setu/config.ts
// Env validation, environment → base URL mapping, legacy
// variable fallback, fail-fast behavior.
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { getSetuConfig, isSetuConfigured, SetuConfigError } from "@/lib/banking/setu/config";

const REQUIRED = ["SETU_AA_ENV", "SETU_CLIENT_ID", "SETU_SECRET", "SETU_CLIENT_SECRET", "SETU_PRODUCT_INSTANCE_ID", "SETU_WEBHOOK_SECRET", "SETU_AA_BASE_URL"];

function clearSetuEnv() {
  for (const key of REQUIRED) delete process.env[key];
}

describe("getSetuConfig", () => {
  beforeEach(clearSetuEnv);

  it("throws SetuConfigError listing every missing variable", () => {
    expect(() => getSetuConfig()).toThrow(SetuConfigError);
    try {
      getSetuConfig();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("SETU_CLIENT_ID");
      expect(message).toContain("SETU_SECRET");
      expect(message).toContain("SETU_PRODUCT_INSTANCE_ID");
    }
  });

  it("maps sandbox env to the sandbox base URL", () => {
    process.env.SETU_AA_ENV = "sandbox";
    process.env.SETU_CLIENT_ID = "cid";
    process.env.SETU_SECRET = "secret";
    process.env.SETU_PRODUCT_INSTANCE_ID = "pid";

    const config = getSetuConfig();
    expect(config.env).toBe("sandbox");
    expect(config.baseUrl).toBe("https://fiu-sandbox.setu.co");
  });

  it("maps production env to the production base URL and requires webhook secret", () => {
    process.env.SETU_AA_ENV = "production";
    process.env.SETU_CLIENT_ID = "cid";
    process.env.SETU_SECRET = "secret";
    process.env.SETU_PRODUCT_INSTANCE_ID = "pid";

    // Production without webhook secret → fail fast
    expect(() => getSetuConfig()).toThrow(/SETU_WEBHOOK_SECRET/);

    process.env.SETU_WEBHOOK_SECRET = "whsec";
    const config = getSetuConfig();
    expect(config.env).toBe("production");
    expect(config.baseUrl).toBe("https://fiu.setu.co");
  });

  it("falls back to legacy SETU_CLIENT_SECRET when SETU_SECRET is absent", () => {
    process.env.SETU_AA_ENV = "sandbox";
    process.env.SETU_CLIENT_ID = "cid";
    process.env.SETU_CLIENT_SECRET = "legacy-secret";
    process.env.SETU_PRODUCT_INSTANCE_ID = "pid";

    expect(getSetuConfig().clientSecret).toBe("legacy-secret");
  });

  it("honors SETU_AA_BASE_URL override", () => {
    process.env.SETU_AA_ENV = "sandbox";
    process.env.SETU_CLIENT_ID = "cid";
    process.env.SETU_SECRET = "secret";
    process.env.SETU_PRODUCT_INSTANCE_ID = "pid";
    process.env.SETU_AA_BASE_URL = "https://mock-setu.local";

    expect(getSetuConfig().baseUrl).toBe("https://mock-setu.local");
  });

  it("isSetuConfigured reflects configuration state without throwing", () => {
    expect(isSetuConfigured()).toBe(false);
    process.env.SETU_AA_ENV = "sandbox";
    process.env.SETU_CLIENT_ID = "cid";
    process.env.SETU_SECRET = "secret";
    process.env.SETU_PRODUCT_INSTANCE_ID = "pid";
    expect(isSetuConfigured()).toBe(true);
  });
});
