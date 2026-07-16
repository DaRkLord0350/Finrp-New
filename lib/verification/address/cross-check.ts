// ============================================================
// lib/verification/address/cross-check.ts
//
// Address verification has no dedicated vendor here — instead we
// cross-check the address strings already captured across a subject's
// OTHER verified sources (PAN/GST registered address, bank branch
// address from IFSC, Aadhaar eKYC address, customer-entered address).
// Reuses the same normalized-Levenshtein similarity as AML name
// matching (lib/aml/core/name-matching.ts) rather than a second
// string-distance implementation — addresses are just noisier strings.
// ============================================================

import { nameSimilarity } from "@/lib/aml/core/name-matching";

export interface AddressSource {
  source: string; // e.g. "PAN_RECORD", "BANK_IFSC", "AADHAAR_EKYC", "CUSTOMER_ENTERED"
  address: string;
}

export interface AddressPairComparison {
  sourceA: string;
  sourceB: string;
  similarity: number; // 0-100
}

export type AddressCrossCheckVerdict = "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "INSUFFICIENT_DATA";

export interface AddressCrossCheckResult {
  verdict: AddressCrossCheckVerdict;
  averageSimilarity: number;
  comparisons: AddressPairComparison[];
}

const MATCH_THRESHOLD = 75;
const PARTIAL_THRESHOLD = 45;

/**
 * Compares every pair of address sources and rolls the pairwise scores
 * up into one verdict. Two sources is the common case (one new address
 * vs. one already-verified one); three or more sources are compared
 * pairwise and averaged.
 */
export function crossCheckAddresses(entries: AddressSource[]): AddressCrossCheckResult {
  const usable = entries.filter((e) => e.address && e.address.trim().length > 0);
  if (usable.length < 2) {
    return { verdict: "INSUFFICIENT_DATA", averageSimilarity: 0, comparisons: [] };
  }

  const comparisons: AddressPairComparison[] = [];
  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      comparisons.push({
        sourceA: usable[i].source,
        sourceB: usable[j].source,
        similarity: nameSimilarity(usable[i].address, usable[j].address),
      });
    }
  }

  const averageSimilarity = Math.round(comparisons.reduce((sum, c) => sum + c.similarity, 0) / comparisons.length);

  const verdict: AddressCrossCheckVerdict =
    averageSimilarity >= MATCH_THRESHOLD ? "MATCH" : averageSimilarity >= PARTIAL_THRESHOLD ? "PARTIAL_MATCH" : "MISMATCH";

  return { verdict, averageSimilarity, comparisons };
}
