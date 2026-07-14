import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { orgDocumentService } from "@/lib/services/org-document.service";
import { mapOrgDocumentError } from "@/lib/org-document/http";

// Module 3 — Document Vault. The predefined slot list, extended with
// the KYC document types from the Phase 1 spec. Each slot maps 1:1 to
// an `organizationId + documentType` OrganizationDocument row — upload
// replaces the slot's file (versioned underneath, see
// lib/services/org-document.service.ts), it does not create a second
// visible row. Uploading a documentType NOT in this list is still
// allowed (it shows up in `extraDocs`), matching the existing behavior.
const DOCUMENT_TYPES = [
  { key: "PAN", label: "PAN Card" },
  { key: "GST_CERTIFICATE", label: "GST Certificate" },
  { key: "INCORPORATION", label: "Certificate of Incorporation" },
  { key: "BANK_STATEMENT", label: "Bank Statement" },
  { key: "MSME", label: "MSME / Udyam Certificate" },
  { key: "TAN", label: "TAN Certificate" },
  { key: "ADDRESS_PROOF", label: "Address Proof" },
  { key: "FINANCIAL_STATEMENTS", label: "Financial Statements" },
  // ── Module 3 (Phase 1) additions ──
  { key: "AADHAAR", label: "Aadhaar" },
  { key: "BOARD_RESOLUTION", label: "Board Resolution" },
  { key: "CANCELLED_CHEQUE", label: "Cancelled Cheque" },
  { key: "ELECTRICITY_BILL", label: "Electricity Bill" },
  { key: "MOA", label: "Memorandum of Association (MOA)" },
  { key: "AOA", label: "Articles of Association (AOA)" },
  { key: "FSSAI", label: "FSSAI License" },
  { key: "IEC", label: "Import Export Code (IEC)" },
  { key: "SHOP_LICENSE", label: "Shop & Establishment License" },
  { key: "PARTNERSHIP_DEED", label: "Partnership Deed" },
  { key: "LLP_AGREEMENT", label: "LLP Agreement" },
  { key: "OTHER", label: "Other Documents" },
];

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const uploaded = await orgDocumentService.list(tenantId);

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
    const { documentType, displayName, fileName, mimeType, fileSize, fileUrl, expiryDate, notes, folder, tags } = body;

    if (!documentType || !fileName || !fileUrl) {
      return NextResponse.json({ error: "documentType, fileName, fileUrl required" }, { status: 400 });
    }

    const document = await orgDocumentService.upload(
      tenantId,
      { userId: dbUser.id },
      {
        documentType,
        displayName: displayName || fileName,
        fileName,
        mimeType: mimeType || "application/octet-stream",
        fileSize: fileSize || 0,
        fileUrl,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes: notes || null,
        folder: folder || null,
        tags: Array.isArray(tags) ? tags : [],
      }
    );

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return mapOrgDocumentError(error, "SETTINGS_DOCUMENTS_POST");
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

    await orgDocumentService.remove(tenantId, { userId: dbUser.id }, docId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return mapOrgDocumentError(error, "SETTINGS_DOCUMENTS_DELETE");
  }
}
