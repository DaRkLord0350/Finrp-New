import { describe, it, expect } from "vitest";
import { detectCreditScoreDrop } from "@/lib/monitoring/rules/credit";

describe("detectCreditScoreDrop", () => {
  it("returns null when fewer than two scores exist", () => {
    expect(detectCreditScoreDrop([], 50)).toBeNull();
    expect(detectCreditScoreDrop([{ score: 750, scoreDate: "2026-01-01" }], 50)).toBeNull();
  });

  it("returns null when the drop is below the threshold", () => {
    const scores = [
      { score: 720, scoreDate: "2026-06-01" },
      { score: 740, scoreDate: "2026-01-01" },
    ];
    expect(detectCreditScoreDrop(scores, 50)).toBeNull();
  });

  it("flags a drop that meets or exceeds the threshold, comparing the two most-recent pulls by date", () => {
    const scores = [
      { score: 650, scoreDate: "2026-06-01" }, // most recent
      { score: 750, scoreDate: "2026-01-01" }, // previous
    ];
    const result = detectCreditScoreDrop(scores, 50);
    expect(result).toEqual({ previousScore: 750, currentScore: 650, drop: 100 });
  });

  it("sorts by date rather than array order", () => {
    const scores = [
      { score: 750, scoreDate: "2026-01-01" }, // older, listed first
      { score: 650, scoreDate: "2026-06-01" }, // newer, listed second
    ];
    const result = detectCreditScoreDrop(scores, 50);
    expect(result).toEqual({ previousScore: 750, currentScore: 650, drop: 100 });
  });

  it("ignores an improved score (negative drop)", () => {
    const scores = [
      { score: 800, scoreDate: "2026-06-01" },
      { score: 700, scoreDate: "2026-01-01" },
    ];
    expect(detectCreditScoreDrop(scores, 50)).toBeNull();
  });
});
