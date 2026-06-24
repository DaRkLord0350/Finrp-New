// ============================================================
// /api/ca/documents
//   POST → upload a vault document for an assigned client.
// Stores metadata + fileUrl (hosted URL or data URL), same pattern
// as the firm vault. Scoped to the CA's assigned customers.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCAApi, isAdmin } from "@/lib/ca/api-auth";
import { isCustomerAssignedTo } from "@/lib/ca/portal";
import type { DocumentFolder } from "@prisma/client";

const FOLDERS: DocumentFolder[] = [
  "GST", "INCOME_TAX", "TDS", "AUDIT", "ROC", "PAYROLL", "BANK_STATEMENTS", "INVOICES", "OTHER",
];

export async function POST(req: NextRequest) {
  const user = await requireCAApi();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const customerId = String(body?.customerId ?? "");
  const folder = body?.folder as DocumentFolder;
  const displayName = String(body?.displayName ?? "").trim();
  const fileName = String(body?.fileName ?? "").trim();
  const fileUrl = String(body?.fileUrl ?? "").trim();

  if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  if (!FOLDERS.includes(folder)) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  if (!displayName) return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  if (!fileName || !fileUrl) return NextResponse.json({ error: "A file name and URL are required" }, { status: 400 });

  if (!isAdmin(user) && !(await isCustomerAssignedTo(user.id, customerId))) {
    return NextResponse.json({ error: "You are not assigned to this client" }, { status: 403 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { organizationId: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const fileSize = Number(body?.fileSize ?? 0) || 0;
  const doc = await prisma.customerDocument.create({
    data: {
      organizationId: customer.organizationId,
      customerId,
      firmId: user.firmId,
      folder,
      displayName,
      fileName,
      fileUrl,
      fileSize,
      mimeType: body?.mimeType ? String(body.mimeType) : null,
      isConfidential: body?.isConfidential === true,
      notes: body?.notes ? String(body.notes).trim() : null,
      uploadedById: user.id,
      currentVersion: 1,
      versions: { create: { versionNumber: 1, fileUrl, fileName, fileSize, uploadedById: user.id } },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
