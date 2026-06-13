// ============================================================
// Unit tests — lib/banking/providers/setu.provider.ts
// Webhook signature verification, FI payload parsing, HTTP
// retry/backoff behavior with a mocked fetch.
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";
import { SetuProvider, parseFIPayload } from "@/lib/banking/providers/setu.provider";
import { BankingProviderError } from "@/lib/banking/providers/types";

const WEBHOOK_SECRET = "test-webhook-secret";

function setSandboxEnv() {
  process.env.SETU_AA_ENV = "sandbox";
  process.env.SETU_CLIENT_ID = "cid";
  process.env.SETU_SECRET = "secret";
  process.env.SETU_PRODUCT_INSTANCE_ID = "pid";
  process.env.SETU_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.SETU_AA_BASE_URL;
}

beforeEach(setSandboxEnv);
afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// verifyWebhook
// ---------------------------------------------------------------------------
describe("SetuProvider.verifyWebhook", () => {
  const provider = new SetuProvider();
  const body = JSON.stringify({ type: "CONSENT_STATUS_UPDATE", consentId: "c-1" });

  it("accepts a valid hex HMAC signature", () => {
    const sig = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
    expect(provider.verifyWebhook(body, sig).valid).toBe(true);
  });

  it("accepts a valid base64 HMAC signature", () => {
    const sig = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("base64");
    expect(provider.verifyWebhook(body, sig).valid).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
    const result = provider.verifyWebhook(body + "x", sig);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("signature mismatch");
  });

  it("rejects a wrong-secret signature", () => {
    const sig = createHmac("sha256", "wrong-secret").update(body).digest("hex");
    expect(provider.verifyWebhook(body, sig).valid).toBe(false);
  });

  it("rejects missing signature in production", () => {
    process.env.SETU_AA_ENV = "production";
    const result = provider.verifyWebhook(body, null);
    expect(result.valid).toBe(false);
  });

  it("accepts but flags unsigned webhooks in sandbox", () => {
    const result = provider.verifyWebhook(body, null);
    expect(result.valid).toBe(true);
    expect(result.reason).toBe("sandbox-unsigned");
  });
});

// ---------------------------------------------------------------------------
// parseFIPayload
// ---------------------------------------------------------------------------
describe("parseFIPayload", () => {
  const sessionPayload = {
    id: "session-1",
    status: "COMPLETED",
    payload: [
      {
        fipID: "HDFC-FIP",
        fipName: "HDFC Bank",
        data: [
          {
            linkRefNumber: "link-001",
            maskedAccNumber: "XXXXXX4321",
            fiType: "DEPOSIT",
            decryptedFI: {
              account: {
                type: "deposit",
                summary: {
                  currentBalance: "150000.55",
                  availableBalance: "149000.55",
                  currency: "INR",
                  balanceDateTime: "2026-06-10T10:00:00.000Z",
                  type: "SAVINGS",
                },
                transactions: {
                  transaction: [
                    {
                      txnId: "TXN-1",
                      type: "CREDIT",
                      mode: "UPI",
                      amount: "5000",
                      currentBalance: "150000.55",
                      transactionTimestamp: "2026-06-09T09:30:00.000Z",
                      valueDate: "2026-06-09",
                      narration: "UPI/INV-2042/payment",
                      reference: "INV-2042",
                    },
                    {
                      // missing txnId — must synthesize a stable dedup key
                      type: "DEBIT",
                      mode: "NEFT",
                      amount: 1200.5,
                      transactionTimestamp: "2026-06-08T12:00:00.000Z",
                      narration: "NEFT charge",
                    },
                    {
                      // malformed (no amount) — must be skipped
                      type: "DEBIT",
                      mode: "UPI",
                      transactionTimestamp: "2026-06-08T12:00:00.000Z",
                      narration: "broken row",
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    ],
  };

  it("extracts accounts, balances, and transactions from a v2 session payload", () => {
    const parsed = parseFIPayload(sessionPayload as never);

    expect(parsed.accounts).toHaveLength(1);
    expect(parsed.accounts[0]).toMatchObject({
      linkRefNumber: "link-001",
      maskedAccNumber: "XXXXXX4321",
      fiType: "DEPOSIT",
      fipId: "HDFC-FIP",
      fipName: "HDFC Bank",
    });

    expect(parsed.balances).toHaveLength(1);
    expect(parsed.balances[0].currentBalance).toBe(150000.55);
    expect(parsed.balances[0].availableBalance).toBe(149000.55);
    expect(parsed.balances[0].currency).toBe("INR");

    expect(parsed.transactions).toHaveLength(2); // malformed row skipped
    const [credit, debit] = parsed.transactions;
    expect(credit).toMatchObject({ externalId: "TXN-1", type: "CREDIT", amount: 5000, reference: "INV-2042" });
    expect(debit.type).toBe("DEBIT");
    expect(debit.externalId).toContain("link-001:"); // synthesized key
  });

  it("synthesizes identical dedup ids for identical txn rows", () => {
    const a = parseFIPayload(sessionPayload as never).transactions[1].externalId;
    const b = parseFIPayload(sessionPayload as never).transactions[1].externalId;
    expect(a).toBe(b);
  });

  it("returns empty results for an empty payload", () => {
    const parsed = parseFIPayload({ status: "COMPLETED" });
    expect(parsed.accounts).toHaveLength(0);
    expect(parsed.balances).toHaveLength(0);
    expect(parsed.transactions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// HTTP retry behavior (mocked fetch)
// ---------------------------------------------------------------------------
describe("SetuProvider HTTP retries", () => {
  it("retries on 429 and succeeds on the next attempt", async () => {
    const provider = new SetuProvider();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "consent-1", url: "https://aa/approve", status: "PENDING" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.createConsent({
      organizationId: "org-1",
      redirectUrl: "https://app/callback",
    });

    expect(result.consentId).toBe("consent-1");
    expect(result.redirectUrl).toBe("https://aa/approve");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("does not retry on 4xx client errors and surfaces the provider error code", async () => {
    const provider = new SetuProvider();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "INVALID_CONSENT", detail: "bad consent body" } }), { status: 400 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      provider.createConsent({ organizationId: "org-1", redirectUrl: "https://app/callback" })
    ).rejects.toMatchObject({ code: "INVALID_CONSENT", status: 400, retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws MALFORMED_RESPONSE when consent response has no id/url", async () => {
    const provider = new SetuProvider();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    await expect(
      provider.createConsent({ organizationId: "org-1", redirectUrl: "https://app/callback" })
    ).rejects.toBeInstanceOf(BankingProviderError);
  });

  it("sends Setu auth headers on every request", async () => {
    const provider = new SetuProvider();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "c1", url: "https://aa/x", status: "PENDING" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await provider.createConsent({ organizationId: "org-1", redirectUrl: "https://app/cb" });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers["x-client-id"]).toBe("cid");
    expect(headers["x-client-secret"]).toBe("secret");
    expect(headers["x-product-instance-id"]).toBe("pid");
    expect(headers["x-request-id"]).toBeTruthy();
  });
});
