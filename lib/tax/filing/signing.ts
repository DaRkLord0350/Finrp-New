// ============================================================
// lib/tax/filing/signing.ts
//
// DSC / Aadhaar-eSign abstraction. Signing providers can be swapped
// without touching filing logic. A TaxSigningRequest row tracks each
// signature lifecycle; the signer's PAN is stored encrypted.
// ============================================================

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, TaxScheme, TaxSigningType } from "@prisma/client";
import { encryptPan } from "../core/pii";

export interface SignArgs {
  documentHash: string;
  signerName?: string;
  signerEmail?: string;
  signerPan?: string;
}

export interface SignResult {
  status: "SIGNED" | "SENT" | "FAILED";
  providerRef?: string;
  signatureData?: Record<string, unknown>;
}

export interface SigningProvider {
  readonly type: TaxSigningType;
  readonly isLive: boolean;
  sign(args: SignArgs): Promise<SignResult>;
}

/** Deterministic mock signer — produces a signature hash, no real DSC. */
export class MockSigningProvider implements SigningProvider {
  readonly type: TaxSigningType = "MOCK";
  readonly isLive = false;
  async sign(args: SignArgs): Promise<SignResult> {
    const sig = createHash("sha256").update(`${args.documentHash}:${args.signerPan ?? "NA"}`).digest("hex");
    return { status: "SIGNED", providerRef: `MOCK-SIG-${sig.slice(0, 16)}`, signatureData: { algorithm: "mock-sha256", signature: sig } };
  }
}

export function getSigningProvider(): SigningProvider {
  // Future: read TAX_SIGNING_PROVIDER env to pick DSC / Aadhaar eSign.
  return new MockSigningProvider();
}

/**
 * Create a signing request, invoke the provider, and persist the result.
 * Returns the request row id. PAN is encrypted before storage.
 */
export async function createAndSign(params: {
  organizationId: string;
  scheme: TaxScheme;
  subjectType: string;
  subjectId?: string;
  documentHash: string;
  signerName?: string;
  signerEmail?: string;
  signerPan?: string;
  createdById?: string;
}): Promise<{ id: string; status: string; providerRef?: string }> {
  const provider = getSigningProvider();

  const req = await prisma.taxSigningRequest.create({
    data: {
      organizationId: params.organizationId,
      scheme: params.scheme,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      provider: provider.type,
      status: "SENT",
      signerName: params.signerName,
      signerEmail: params.signerEmail,
      signerPanEnc: params.signerPan ? encryptPan(params.signerPan) : null,
      documentHash: params.documentHash,
      sentAt: new Date(),
      createdById: params.createdById,
    },
  });

  try {
    const result = await provider.sign({
      documentHash: params.documentHash,
      signerName: params.signerName,
      signerEmail: params.signerEmail,
      signerPan: params.signerPan,
    });
    const updated = await prisma.taxSigningRequest.update({
      where: { id: req.id },
      data: {
        status: result.status,
        providerRef: result.providerRef,
        signatureData: (result.signatureData ?? undefined) as Prisma.InputJsonValue | undefined,
        signedAt: result.status === "SIGNED" ? new Date() : null,
      },
    });
    return { id: updated.id, status: updated.status, providerRef: updated.providerRef ?? undefined };
  } catch (err) {
    await prisma.taxSigningRequest.update({
      where: { id: req.id },
      data: { status: "FAILED" },
    });
    throw err;
  }
}
