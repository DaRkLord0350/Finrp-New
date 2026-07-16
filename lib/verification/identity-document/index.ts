import type { IdentityDocumentProvider } from "./types";
import { IdentityDocumentHttpProvider } from "./provider";
import { MockIdentityDocumentProvider } from "./mock-provider";

export * from "./types";

let cached: IdentityDocumentProvider | null = null;

export function getIdentityDocumentProvider(): IdentityDocumentProvider {
  if (cached) return cached;
  cached = process.env.IDENTITY_DOCUMENT_MOCK_MODE === "true" ? new MockIdentityDocumentProvider() : new IdentityDocumentHttpProvider();
  return cached;
}

export function resetIdentityDocumentProviderCache(): void {
  cached = null;
}
