import { createHash } from "crypto";
import type { IdentityDocumentInput, IdentityDocumentProvider, IdentityDocumentResult } from "./types";

export class MockIdentityDocumentProvider implements IdentityDocumentProvider {
  readonly name = "IDENTITY_DOCUMENT_MOCK";

  async verify(input: IdentityDocumentInput): Promise<IdentityDocumentResult> {
    const seed = parseInt(
      createHash("sha256").update(`${input.documentType}:${input.documentNumber}`).digest("hex").slice(0, 6),
      16
    );
    const found = seed % 20 !== 0; // ~95% found, deterministic per document number

    if (!found) {
      return { outcome: "FAILED", status: "NOT_FOUND", raw: { mock: true }, failureReason: "Document number not found in mock registry" };
    }

    const nameMatchScore = input.nameToMatch ? 80 + (seed % 21) : undefined;
    return {
      outcome: "VERIFIED",
      registeredName: input.nameToMatch ?? "MOCK REGISTERED NAME",
      nameMatchScore,
      status: "VALID",
      raw: { mock: true, documentType: input.documentType },
    };
  }
}
