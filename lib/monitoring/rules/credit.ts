// ============================================================
// lib/monitoring/rules/credit.ts
//
// Pure comparison over a subject's CreditScore history (Module 2) —
// nothing currently alerts when a re-pulled score drops significantly
// versus the previous pull.
// ============================================================

export interface ScoreLike {
  score: number;
  scoreDate: string; // ISO
}

export interface CreditScoreDropResult {
  previousScore: number;
  currentScore: number;
  drop: number;
}

/** Compares the two most-recent scores (by date) and reports a drop only if it meets the threshold. */
export function detectCreditScoreDrop(scores: ScoreLike[], dropThreshold: number): CreditScoreDropResult | null {
  if (scores.length < 2) return null;
  const sorted = [...scores].sort((a, b) => new Date(b.scoreDate).getTime() - new Date(a.scoreDate).getTime());
  const [current, previous] = sorted;
  const drop = previous.score - current.score;
  if (drop < dropThreshold) return null;
  return { previousScore: previous.score, currentScore: current.score, drop };
}
