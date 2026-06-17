// ============================================================
// /api/firm/vault/[id]/versions
//   GET  → version history
//   POST → upload a new version (bumps currentVersion, points the
//          document at the latest file)
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";
import { MAX_INLINE_BYTES } from "@/lib/vault/constants";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.customerDocument.findFirst({
    where: { id, organizationId: admin.organizationId },
    select: { id: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const versions = await prisma.customerDocumentVersion.findMany({
    where: { documentId: id },
    orderBy: { versionNumber: "desc" },
  });
  return NextResponse.json({ versions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.customerDocument.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const fileUrl = String(body?.fileUrl ?? "").trim();
  const fileName = String(body?.fileName ?? "").trim();
  const fileSize = Number(body?.fileSize ?? 0) || 0;
  if (!fileUrl || !fileName)
    return NextResponse.json({ error: "A file or file URL is required" }, { status: 400 });
  if (fileUrl.startsWith("data:") && fileSize > MAX_INLINE_BYTES)
    return NextResponse.json({ error: "Inline file too large — use a hosted URL" }, { status: 400 });

  const nextVersion = doc.currentVersion + 1;

  await prisma.$transaction([
    prisma.customerDocumentVersion.create({
      data: {
        documentId: id,
        versionNumber: nextVersion,
        fileUrl,
        fileName,
        fileSize,
        uploadedById: admin.id,
        notes: body?.notes ? String(body.notes).trim() : null,
      },
    }),
    prisma.customerDocument.update({
      where: { id },
      data: { currentVersion: nextVersion, fileUrl, fileName, fileSize },
    }),
  ]);

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    action: "DOCUMENT_VERSION_ADDED",
    module: "DOCUMENT",
    metadata: { documentId: id, version: nextVersion },
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ ok: true, version: nextVersion }, { status: 201 });
}
