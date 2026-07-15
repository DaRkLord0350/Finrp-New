// ============================================================
// Unit tests — lib/tbx/statements/*
// Mock provider output, parser validation, mapper correctness, and
// the real client's "no fabricated endpoints" guarantee (Phase 2B).
// ============================================================

import { describe, it, expect } from "vitest";
import { MockTbxStatementProvider } from "@/lib/tbx/statements/statement.mock";
import { TbxStatementHttpClient } from "@/lib/tbx/statements/statement.client";
import { TbxStatementEndpointNotBoundError } from "@/lib/tbx/statements/statement.types";
import { parseStatementLines } from "@/lib/tbx/statements/statement.parser";
import { toBankTransactionRows } from "@/lib/tbx/statements/statement.mapper";

describe("MockTbxStatementProvider", () => {
  it("returns statement lines covering every categorization keyword", async () => {
    const provider = new MockTbxStatementProvider();
    const fromDate = new Date("2026-07-01");
    const toDate = new Date("2026-07-15");
    const result = await provider.fetchStatement({ organizationId: "org_test", bankAccountId: "acct_test_123", fromDate, toDate });

    expect(result.outcome).toBe("SUCCESS");
    expect(result.lines.length).toBeGreaterThan(0);

    const narrations = result.lines.map((l) => l.narration.toLowerCase()).join(" | ");
    expect(narrations).toContain("salary");
    expect(narrations).toContain("gst");

    for (const line of result.lines) {
      expect(line.externalTxnId).toBeTruthy();
      expect(["CREDIT", "DEBIT"]).toContain(line.type);
      expect(line.amount).toBeGreaterThan(0);
    }
  });

  it("produces unique externalTxnIds within one fetch", async () => {
    const provider = new MockTbxStatementProvider();
    const result = await provider.fetchStatement({
      organizationId: "org_test",
      bankAccountId: "acct_test_123",
      fromDate: new Date("2026-07-01"),
      toDate: new Date("2026-07-20"),
    });
    const ids = result.lines.map((l) => l.externalTxnId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("parseStatementLines", () => {
  it("parses valid lines and maps mode to an initial txnType", () => {
    const { lines, errors } = parseStatementLines([
      {
        externalTxnId: "t1",
        transactionDate: "2026-07-10T00:00:00.000Z",
        narration: "TEST NEFT",
        amount: 1000,
        type: "CREDIT",
        mode: "NEFT",
      },
    ]);
    expect(errors).toHaveLength(0);
    expect(lines).toHaveLength(1);
    expect(lines[0].credit).toBe(1000);
    expect(lines[0].debit).toBeUndefined();
    expect(lines[0].txnType).toBe("NEFT");
  });

  it("defaults to UNKNOWN txnType when mode is absent or unrecognized", () => {
    const { lines } = parseStatementLines([
      { externalTxnId: "t2", transactionDate: "2026-07-10T00:00:00.000Z", narration: "NO MODE", amount: 500, type: "DEBIT" },
    ]);
    expect(lines[0].txnType).toBe("UNKNOWN");
  });

  it("rejects lines with missing externalTxnId, non-positive amount, or invalid date", () => {
    const { lines, errors } = parseStatementLines([
      { externalTxnId: "", transactionDate: "2026-07-10", narration: "no id", amount: 100, type: "CREDIT" },
      { externalTxnId: "t3", transactionDate: "2026-07-10", narration: "bad amount", amount: 0, type: "CREDIT" },
      { externalTxnId: "t4", transactionDate: "not-a-date", narration: "bad date", amount: 100, type: "CREDIT" },
    ]);
    expect(lines).toHaveLength(0);
    expect(errors).toHaveLength(3);
  });
});

describe("toBankTransactionRows", () => {
  it("maps parsed lines into BankTransaction createMany rows with TBX_API source", () => {
    const { lines } = parseStatementLines([
      {
        externalTxnId: "t5",
        transactionDate: "2026-07-10T00:00:00.000Z",
        narration: "VENDOR PAYMENT",
        amount: 2000,
        type: "DEBIT",
        mode: "NEFT",
        utr: "UTR123",
      },
    ]);
    const rows = toBankTransactionRows("org_test", "acct_test_123", lines);

    expect(rows).toHaveLength(1);
    expect(rows[0].organizationId).toBe("org_test");
    expect(rows[0].bankAccountId).toBe("acct_test_123");
    expect(rows[0].externalTxnId).toBe("t5");
    expect(rows[0].source).toBe("TBX_API");
    expect(rows[0].status).toBe("UNREVIEWED");
    expect(rows[0].utr).toBe("UTR123");
    expect(rows[0].debit?.toString()).toBe("2000");
    expect(rows[0].credit).toBeNull();
  });
});

describe("TbxStatementHttpClient — no fabricated endpoints", () => {
  it("throws TbxStatementEndpointNotBoundError instead of guessing a real HTTP call", async () => {
    const client = new TbxStatementHttpClient();
    await expect(
      client.fetchStatement({
        organizationId: "org_test",
        bankAccountId: "acct_test_123",
        fromDate: new Date("2026-07-01"),
        toDate: new Date("2026-07-15"),
      })
    ).rejects.toThrow(TbxStatementEndpointNotBoundError);
  });
});
