import { describe, it, expect } from "vitest";
import { nameSimilarity, matchAgainstCandidates } from "@/lib/aml/core/name-matching";

describe("nameSimilarity", () => {
  it("returns 100 for identical names", () => {
    expect(nameSimilarity("Vladimir Putin", "Vladimir Putin")).toBe(100);
  });

  it("is case-insensitive and whitespace/punctuation-tolerant", () => {
    expect(nameSimilarity("vladimir   putin", "VLADIMIR, PUTIN.")).toBe(100);
  });

  it("scores a minor misspelling highly but not 100", () => {
    const score = nameSimilarity("Vladimir Putin", "Vladimir Putyn");
    expect(score).toBeGreaterThan(85);
    expect(score).toBeLessThan(100);
  });

  it("scores unrelated names low", () => {
    expect(nameSimilarity("Vladimir Putin", "John Smith")).toBeLessThan(40);
  });

  it("returns 0 for an empty name", () => {
    expect(nameSimilarity("", "Anyone")).toBe(0);
  });
});

describe("matchAgainstCandidates", () => {
  const candidates = [
    { entryId: "e1", primaryName: "Osama bin Laden", aliases: ["Usama Bin Ladin", "The Sheikh"] },
    { entryId: "e2", primaryName: "Jane Doe", aliases: [] },
  ];

  it("matches against an alias when the alias is a closer match than the primary name", () => {
    const results = matchAgainstCandidates("Usama Bin Ladin", candidates, 80);
    expect(results[0].entryId).toBe("e1");
    expect(results[0].matchedOn).toBe("Usama Bin Ladin");
  });

  it("filters out results below the threshold", () => {
    const results = matchAgainstCandidates("Completely Different Person", candidates, 80);
    expect(results).toHaveLength(0);
  });

  it("sorts results by best score descending", () => {
    const results = matchAgainstCandidates("Jane Doe", candidates, 10);
    expect(results[0].entryId).toBe("e2");
    expect(results[0].bestScore).toBe(100);
  });
});
