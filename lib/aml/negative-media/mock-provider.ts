import { createHash } from "crypto";
import type { NegativeMediaProvider, NegativeMediaSearchInput, NegativeMediaSearchResult } from "./types";

export class MockNegativeMediaProvider implements NegativeMediaProvider {
  readonly name = "NEGATIVE_MEDIA_MOCK";

  async search(input: NegativeMediaSearchInput): Promise<NegativeMediaSearchResult> {
    const seed = parseInt(createHash("sha256").update(input.subjectName).digest("hex").slice(0, 6), 16);
    // Deterministic: ~1 in 8 subjects gets a mock hit, so the case-management
    // path is exercised without every screen producing an alert.
    if (seed % 8 !== 0) return { outcome: "SUCCESS", hits: [], raw: { mock: true } };

    return {
      outcome: "SUCCESS",
      hits: [
        {
          headline: `${input.subjectName} named in regulatory inquiry`,
          source: "Mock Wire Service",
          publishedDate: new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10),
          category: "Regulatory",
          relevanceScore: 65,
        },
      ],
      raw: { mock: true },
    };
  }
}
