// ============================================================
// /api/ca/documents/[id]/review
//   POST → record a review decision (approve / reject / re-upload),
//          optionally raising an e-sign request. Keeps the linked
//          checklist item status in sync.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCAApi, isAdmin } from "@/lib/ca/api-auth";
import { isCustomerAssignedTo } from "@/lib/ca/portal";
import type { DocumentReviewDecision, ClientChecklistItemStatus } from "@prisma/client";

const DECISIONS: DocumentReviewDecision[] = ["PENDING", "APPROVED", "REJECTED", "REUPLOAD_REQUESTED"];

const CHECKLIST_STATUS_FOR: Record<DocumentReviewDecision, ClientChecklistItemStatus> = {
  APPROVED: "UPLOADED",
  PENDING: "PENDING_REVIEW",
  REJECTED: "MISSING",
  REUPLOAD_REQUESTED: "MISSING",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCAApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const decision = body?.decision as DocumentReviewDecision;
  const comment = body?.comment ? String(body.comment).trim() : null;
  const requestSignature = body?.requestSignature === true;

  if (!DECISIONS.includes(decision)) return NextResponse.json({ error: "Invalid decision" }, { status: 400 });

  const doc = await prisma.customerDocument.findUnique({
    where: { id },
    select: {
      id: true, customerId: true, organizationId: true, currentVersion: true, displayName: true, fileUrl: true,
      customer: { select: { name: true, email: true } },
    },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  if (!isAdmin(user) && !(await isCustomerAssignedTo(user.id, doc.customerId))) {
    return NextResponse.json({ error: "You are not assigned to this client" }, { status: 403 });
  }

  // Optional e-sign hook — create a real SignatureRequest.
  let signatureRequestId: string | null = null;
  if (requestSignature) {
    if (!doc.customer.email) {
      return NextResponse.json({ error: "Client has no email on file for e-sign" }, { status: 400 });
    }
    const sig = await prisma.signatureRequest.create({
      data: {
        organizationId: doc.organizationId,
        title: doc.displayName,
        documentUrl: doc.fileUrl,
        signerEmail: doc.customer.email,
        signerName: doc.customer.name,
        caId: user.id,
        caEmail: user.email,
        status: "PENDING",
        provider: "internal",
        createdById: user.id,
      },
      select: { id: true },
    });
    signatureRequestId = sig.id;
  }

  const review = await prisma.documentReview.create({
    data: {
      customerDocumentId: doc.id,
      customerId: doc.customerId,
      organizationId: doc.organizationId,
      reviewerId: user.id,
      decision,
      comment,
      version: doc.currentVersion,
      signatureRequestId,
    },
    select: { id: true },
  });

  // Keep any linked checklist item in sync with the decision.
  await prisma.clientChecklistItem
    .updateMany({
      where: { customerDocumentId: doc.id },
      data: { status: CHECKLIST_STATUS_FOR[decision] },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, reviewId: review.id, signatureRequestId }, { status: 201 });
}
