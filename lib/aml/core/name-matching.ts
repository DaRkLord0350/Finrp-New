// ============================================================
// lib/aml/core/name-matching.ts
//
// Dependency-free fuzzy name matching for sanctions/PEP screening —
// same "no new package for a simple, well-known algorithm" philosophy
// as lib/billing/razorpay.ts. Levenshtein edit distance, normalized to
// a 0-100 similarity score, checked against a watchlist entry's
// primary name AND every alias (the best match wins) so alias
// detection is a natural consequence of the matching function rather
// than a separate feature.
// ============================================================

function normalize(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classic Levenshtein edit distance (insertions/deletions/substitutions). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const currRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow.push(Math.min(currRow[j - 1] + 1, prevRow[j] + 1, prevRow[j - 1] + cost));
    }
    prevRow = currRow;
  }
  return prevRow[b.length];
}

/** 0-100 similarity — 100 = identical (after normalization), 0 = completely different. */
export function nameSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 100;
  const distance = levenshtein(na, nb);
  return Math.round((1 - distance / maxLen) * 100);
}

export interface NameMatchCandidate {
  entryId: string;
  primaryName: string;
  aliases: string[];
}

export interface NameMatchResult {
  entryId: string;
  bestScore: number;
  matchedOn: string; // which name (primary or alias) produced the best score
}

/**
 * Scores `subjectName` against every candidate's primary name + aliases,
 * returning the best-scoring name per candidate, sorted descending.
 * `threshold` (default 80) filters out low-confidence noise.
 */
export function matchAgainstCandidates(
  subjectName: string,
  candidates: NameMatchCandidate[],
  threshold = 80
): NameMatchResult[] {
  const results: NameMatchResult[] = [];

  for (const candidate of candidates) {
    let best = { score: nameSimilarity(subjectName, candidate.primaryName), name: candidate.primaryName };
    for (const alias of candidate.aliases) {
      const score = nameSimilarity(subjectName, alias);
      if (score > best.score) best = { score, name: alias };
    }
    if (best.score >= threshold) {
      results.push({ entryId: candidate.entryId, bestScore: best.score, matchedOn: best.name });
    }
  }

  return results.sort((a, b) => b.bestScore - a.bestScore);
}
