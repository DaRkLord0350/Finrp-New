import type { BiometricProvider } from "./types";
import { BiometricHttpProvider } from "./provider";
import { MockBiometricProvider } from "./mock-provider";

export * from "./types";

let cached: BiometricProvider | null = null;

export function getBiometricProvider(): BiometricProvider {
  if (cached) return cached;
  cached = process.env.BIOMETRIC_MOCK_MODE === "true" ? new MockBiometricProvider() : new BiometricHttpProvider();
  return cached;
}

export function resetBiometricProviderCache(): void {
  cached = null;
}
