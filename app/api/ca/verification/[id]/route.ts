import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAuth();
    if (user.userRole === "CUSTOMER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: documentId } = await params;
    const { action, comment } = (await req.json()) as {
      action: "approve" | "reject" | "changes";
      comment?: string;
    };

    // Verify the document belongs to one of this CA's clients
    const doc = await prisma.complianceDocument.findFirst({
      where: {
        id: documentId,
        submission: {
          organization: {
            caClients: { some: { caUserId: user.id } },
          },
        },
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const reviewStatus =
      action === "approve"
        ? "APPROVED"
        : action === "reject"
        ? "REJECTED"
        : "CHANGES_REQUESTED";

    await prisma.complianceDocument.update({
      where: { id: documentId },
      data: {
        reviewStatus,
        reviewComment: comment ?? null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, reviewStatus });
  } catch (error) {
    console.error("[CA verification PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
