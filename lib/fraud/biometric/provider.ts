import {
  BiometricEndpointNotBoundError,
  BiometricNotConfiguredError,
  type BiometricProvider,
  type FaceMatchInput,
  type FaceMatchResult,
  type LivenessCheckInput,
  type LivenessCheckResult,
} from "./types";

function assertConfigured() {
  if (!process.env.BIOMETRIC_BASE_URL || !process.env.BIOMETRIC_API_KEY) throw new BiometricNotConfiguredError();
}

export class BiometricHttpProvider implements BiometricProvider {
  readonly name = "BIOMETRIC_HTTP";

  async matchFace(_input: FaceMatchInput): Promise<FaceMatchResult> {
    assertConfigured();
    throw new BiometricEndpointNotBoundError("matchFace");
  }

  async checkLiveness(_input: LivenessCheckInput): Promise<LivenessCheckResult> {
    assertConfigured();
    throw new BiometricEndpointNotBoundError("checkLiveness");
  }
}
