import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

const DOCUMENT_TYPES = [
  { key: "PAN", label: "PAN Card" },
  { key: "GST_CERTIFICATE", label: "GST Certificate" },
  { key: "INCORPORATION", label: "Incorporation Certificate" },
  { key: "BANK_STATEMENT", label: "Bank Statement" },
  { key: "MSME", label: "MSME Certificate" },
  { key: "TAN", label: "TAN Certificate" },
  { key: "ADDRESS_PROOF", label: "Address Proof" },
  { key: "FINANCIAL_STATEMENTS", label: "Financial Statements" },
];

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const uploaded = await prisma.organizationDocument.findMany({
      where: { organizationId: tenantId },
      orderBy: { uploadedAt: "desc" },
    });

    // Merge uploaded docs with the required document types list
    const documents = DOCUMENT_TYPES.map((type) => {
      const doc = uploaded.find((d) => d.documentType === type.key);
      return {
        documentType: type.key,
        displayName: type.label,
        required: true,
        document: doc ?? null,
      };
    });

    // Also include any extra uploaded docs not in the predefined list
    const extraDocs = uploaded.filter(
      (d) => !DOCUMENT_TYPES.find((t) => t.key === d.documentType)
    );

    return NextResponse.json({ documents, extraDocs });
  } catch (error) {
    console.error("[SETTINGS_DOCUMENTS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { documentType, displayName, fileName, mimeType, fileSize, fileUrl, expiryDate, notes } = body;

    if (!documentType || !fileName || !fileUrl) {
      return NextResponse.json({ error: "documentType, fileName, fileUrl required" }, { status: 400 });
    }

    const document = await prisma.organizationDocument.upsert({
      where: {
        organizationId_documentType: {
          organizationId: tenantId,
          documentType,
        },
      },
      create: {
        organizationId: tenantId,
        documentType,
        displayName: displayName || fileName,
        fileName,
        mimeType: mimeType || "application/octet-stream",
        fileSize: fileSize || 0,
        fileUrl,
        uploadedById: dbUser.id,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes: notes || null,
        status: "UPLOADED",
      },
      update: {
        displayName: displayName || fileName,
        fileName,
        mimeType: mimeType || "application/octet-stream",
        fileSize: fileSize || 0,
        fileUrl,
        uploadedById: dbUser.id,
        uploadedAt: new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes: notes || null,
        status: "UPLOADED",
        isVerified: false,
        verifiedBy: null,
        verifiedAt: null,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("[SETTINGS_DOCUMENTS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser || !["OWNER", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("id");
    if (!docId) return NextResponse.json({ error: "id required" }, { status: 400 });

    const doc = await prisma.organizationDocument.findFirst({
      where: { id: docId, organizationId: tenantId },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    await prisma.organizationDocument.delete({ where: { id: docId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SETTINGS_DOCUMENTS_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
