import { describe, it, expect } from "vitest";
import { detectHighCashTransactions, detectLargeTransactions, isDormantAccount, type TxnLike } from "@/lib/monitoring/rules/transaction";

const base: TxnLike[] = [
  { id: "1", amount: 50_000, txnType: "CASH", transactionDate: "2026-07-01T00:00:00Z" },
  { id: "2", amount: 250_000, txnType: "CASH", transactionDate: "2026-07-01T00:00:00Z" },
  { id: "3", amount: 1_500_000, txnType: "NEFT", transactionDate: "2026-07-01T00:00:00Z" },
  { id: "4", amount: 10_000, txnType: "UPI", transactionDate: "2026-07-01T00:00:00Z" },
];

describe("detectHighCashTransactions", () => {
  it("only flags CASH transactions at or above the threshold", () => {
    const hits = detectHighCashTransactions(base, 200_000);
    expect(hits.map((h) => h.id)).toEqual(["2"]);
  });

  it("ignores non-cash transactions even if they're large", () => {
    const hits = detectHighCashTransactions(base, 100_000);
    expect(hits.every((h) => h.txnType === "CASH")).toBe(true);
  });
});

describe("detectLargeTransactions", () => {
  it("flags any transaction type at or above the threshold", () => {
    const hits = detectLargeTransactions(base, 1_000_000);
    expect(hits.map((h) => h.id)).toEqual(["3"]);
  });

  it("returns nothing when no transaction meets the threshold", () => {
    expect(detectLargeTransactions(base, 10_000_000)).toHaveLength(0);
  });
});

describe("isDormantAccount", () => {
  const now = new Date("2026-07-16T00:00:00Z");

  it("is dormant when the last transaction is older than the dormancy window", () => {
    const lastTxn = new Date("2026-04-01T00:00:00Z"); // 106 days before `now`
    expect(isDormantAccount(lastTxn, new Date("2020-01-01"), 90, now)).toBe(true);
  });

  it("is not dormant when the last transaction is within the window", () => {
    const lastTxn = new Date("2026-07-10T00:00:00Z"); // 6 days before `now`
    expect(isDormantAccount(lastTxn, new Date("2020-01-01"), 90, now)).toBe(false);
  });

  it("falls back to the account's opening date when it has never transacted", () => {
    const openedLongAgo = new Date("2026-01-01T00:00:00Z");
    expect(isDormantAccount(null, openedLongAgo, 90, now)).toBe(true);

    const openedRecently = new Date("2026-07-15T00:00:00Z");
    expect(isDormantAccount(null, openedRecently, 90, now)).toBe(false);
  });
});
