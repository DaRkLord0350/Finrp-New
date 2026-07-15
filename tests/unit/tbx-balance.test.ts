// ============================================================
// Unit tests — lib/tbx/balance/*
// Mock provider determinism, mapper correctness, and the real
// client's "no fabricated endpoints" guarantee (Phase 2A).
// ============================================================

import { describe, it, expect } from "vitest";
import { MockTbxBalanceProvider } from "@/lib/tbx/balance/balance.mock";
import { TbxBalanceHttpClient } from "@/lib/tbx/balance/balance.client";
import { TbxEndpointNotBoundError } from "@/lib/tbx/balance/balance.types";
import { toBankAccountLatestBalance, toBankBalanceSnapshot } from "@/lib/tbx/balance/balance.mapper";

describe("MockTbxBalanceProvider", () => {
  it("returns a successful, well-typed balance result", async () => {
    const provider = new MockTbxBalanceProvider();
    const result = await provider.fetchBalances({ organizationId: "org_test", bankAccountId: "acct_test_123" });

    expect(result.outcome).toBe("SUCCESS");
    expect(typeof result.currentBalance).toBe("number");
    expect(typeof result.availableBalance).toBe("number");
    expect(typeof result.ledgerBalance).toBe("number");
    expect(result.currency).toBe("INR");
    expect(result.asOf).toBeInstanceOf(Date);
  });

  it("is deterministic for the same account on the same day", async () => {
    const provider = new MockTbxBalanceProvider();
    const a = await provider.fetchBalances({ organizationId: "org_test", bankAccountId: "acct_test_123" });
    const b = await provider.fetchBalances({ organizationId: "org_test", bankAccountId: "acct_test_123" });
    expect(a.currentBalance).toBe(b.currentBalance);
    expect(a.availableBalance).toBe(b.availableBalance);
    expect(a.ledgerBalance).toBe(b.ledgerBalance);
  });

  it("produces different balances for different accounts", async () => {
    const provider = new MockTbxBalanceProvider();
    const a = await provider.fetchBalances({ organizationId: "org_test", bankAccountId: "acct_test_123" });
    const b = await provider.fetchBalances({ organizationId: "org_test", bankAccountId: "acct_other_456" });
    expect(
      a.currentBalance === b.currentBalance &&
        a.availableBalance === b.availableBalance &&
        a.ledgerBalance === b.ledgerBalance
    ).toBe(false);
  });
});

describe("balance mapper", () => {
  it("maps a successful result to a BankBalance snapshot", async () => {
    const provider = new MockTbxBalanceProvider();
    const result = await provider.fetchBalances({ organizationId: "org_test", bankAccountId: "acct_test_123" });
    const snapshot = toBankBalanceSnapshot(result);

    expect(snapshot.currency).toBe("INR");
    expect(snapshot.balanceDate.getUTCHours()).toBe(0);
    expect(snapshot.currentBalance.toString()).toBe(String(result.currentBalance));
  });

  it("maps a successful result to BankAccount latest-balance fields", async () => {
    const provider = new MockTbxBalanceProvider();
    const result = await provider.fetchBalances({ organizationId: "org_test", bankAccountId: "acct_test_123" });
    const latest = toBankAccountLatestBalance(result);

    expect(latest.lastSyncStatus).toBe("SUCCESS");
    expect(latest.lastSyncError).toBeNull();
  });

  it("refuses to map a failed result", () => {
    expect(() => toBankBalanceSnapshot({ outcome: "FAILED", raw: null })).toThrow();
    expect(() => toBankAccountLatestBalance({ outcome: "FAILED", raw: null })).toThrow();
  });
});

describe("TbxBalanceHttpClient — no fabricated endpoints", () => {
  it("throws TbxEndpointNotBoundError instead of guessing a real HTTP call", async () => {
    const client = new TbxBalanceHttpClient();
    await expect(
      client.fetchBalances({ organizationId: "org_test", bankAccountId: "acct_test_123" })
    ).rejects.toThrow(TbxEndpointNotBoundError);
  });
});
