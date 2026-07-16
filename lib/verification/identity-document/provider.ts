import {
  IdentityDocumentEndpointNotBoundError,
  IdentityDocumentNotConfiguredError,
  type IdentityDocumentInput,
  type IdentityDocumentProvider,
  type IdentityDocumentResult,
} from "./types";

function assertConfigured() {
  if (!process.env.IDENTITY_DOCUMENT_BASE_URL || !process.env.IDENTITY_DOCUMENT_API_KEY) {
    throw new IdentityDocumentNotConfiguredError();
  }
}

export class IdentityDocumentHttpProvider implements IdentityDocumentProvider {
  readonly name = "IDENTITY_DOCUMENT_HTTP";
  async verify(input: IdentityDocumentInput): Promise<IdentityDocumentResult> {
    assertConfigured();
    throw new IdentityDocumentEndpointNotBoundError(`verify:${input.documentType}`);
  }
}
