// ============================================================
// /api/firm/vault
//   GET  ?customerId=&folder=  → documents for a customer
//   POST                        → create a vault document (v1)
//
// Stores metadata + fileUrl (data URL for small files, or a hosted
// URL) — same pattern as OrganizationDocument. RBAC: CA_FIRM_ADMIN.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";
import { isValidFolder, MAX_INLINE_BYTES } from "@/lib/vault/constants";
import type { DocumentFolder } from "@prisma/client";

export async function GET(req: NextRequest) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: admin.organizationId },
    select: { id: true },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const folderParam = req.nextUrl.searchParams.get("folder");
  const folder = isValidFolder(folderParam) ? (folderParam as DocumentFolder) : undefined;

  const documents = await prisma.customerDocument.findMany({
    where: { organizationId: admin.organizationId, customerId, ...(folder ? { folder } : {}) },
    select: {
      id: true,
      folder: true,
      displayName: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      currentVersion: true,
      isConfidential: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { versions: true, downloads: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const customerId = String(body.customerId ?? "");
  const folder = body.folder as DocumentFolder;
  const displayName = String(body.displayName ?? "").trim();
  const fileName = String(body.fileName ?? "").trim();
  const fileUrl = String(body.fileUrl ?? "").trim();
  const fileSize = Number(body.fileSize ?? 0) || 0;
  const mimeType = body.mimeType ? String(body.mimeType) : null;

  if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  if (!isValidFolder(folder)) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  if (!displayName) return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  if (!fileName || !fileUrl)
    return NextResponse.json({ error: "A file or file URL is required" }, { status: 400 });
  if (fileUrl.startsWith("data:") && fileSize > MAX_INLINE_BYTES)
    return NextResponse.json({ error: "Inline file too large — use a hosted URL" }, { status: 400 });

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: admin.organizationId },
    include: { customerAssignments: { where: { isActive: true }, select: { caId: true }, take: 1 } },
  });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const doc = await prisma.customerDocument.create({
    data: {
      organizationId: admin.organizationId,
      customerId,
      firmId: admin.firmId,
      folder,
      displayName,
      fileName,
      mimeType,
      fileSize,
      fileUrl,
      currentVersion: 1,
      isConfidential: body.isConfidential === true,
      notes: body.notes ? String(body.notes).trim() : null,
      uploadedById: admin.id,
      versions: {
        create: { versionNumber: 1, fileUrl, fileName, fileSize, uploadedById: admin.id },
      },
    },
    select: { id: true },
  });

  // Notify the assigned CA + audit.
  const caId = customer.customerAssignments[0]?.caId;
  if (caId) {
    await prisma.notification
      .create({
        data: {
          organizationId: admin.organizationId,
          userId: caId,
          type: "DOCUMENT_UPLOADED",
          title: "New document uploaded",
          message: `${displayName} added to ${customer.name}'s vault.`,
          referenceId: doc.id,
          referenceType: "customer_document",
        },
      })
      .catch(() => {});
  }

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    action: "DOCUMENT_UPLOADED",
    module: "DOCUMENT",
    metadata: { customerId, documentId: doc.id, folder, displayName },
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
