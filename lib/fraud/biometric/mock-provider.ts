import { createHash } from "crypto";
import type { BiometricProvider, FaceMatchInput, FaceMatchResult, LivenessCheckInput, LivenessCheckResult } from "./types";

export class MockBiometricProvider implements BiometricProvider {
  readonly name = "BIOMETRIC_MOCK";

  async matchFace(input: FaceMatchInput): Promise<FaceMatchResult> {
    const seed = parseInt(createHash("sha256").update(input.selfieImageUrl + input.idDocumentImageUrl).digest("hex").slice(0, 6), 16);
    return { outcome: "SUCCESS", matchScore: 70 + (seed % 30), raw: { mock: true } };
  }

  async checkLiveness(input: LivenessCheckInput): Promise<LivenessCheckResult> {
    const seed = parseInt(createHash("sha256").update(input.selfieImageUrl).digest("hex").slice(0, 6), 16);
    const passed = seed % 10 !== 0; // ~90% pass, deterministic
    return { outcome: "SUCCESS", passed, confidenceScore: passed ? 85 + (seed % 15) : 20 + (seed % 20), raw: { mock: true } };
  }
}
