// ============================================================
// /api/firm/vault/[id]
//   GET    → document detail with versions + download history
//   PATCH  → rename / move folder / notes / confidential
//   DELETE → remove document (cascades versions + downloads)
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { DocumentFolder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { logTeamActivity, clientIpFrom } from "@/lib/team/activity";
import { isValidFolder } from "@/lib/vault/constants";

async function ownDoc(orgId: string, id: string) {
  return prisma.customerDocument.findFirst({ where: { id, organizationId: orgId } });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.customerDocument.findFirst({
    where: { id, organizationId: admin.organizationId },
    include: {
      versions: { orderBy: { versionNumber: "desc" } },
      downloads: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  return NextResponse.json({ document: doc });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await ownDoc(admin.organizationId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const data: Prisma.CustomerDocumentUpdateInput = {};
  if (body.displayName !== undefined) {
    const v = String(body.displayName).trim();
    if (!v) return NextResponse.json({ error: "Display name cannot be empty" }, { status: 400 });
    data.displayName = v;
  }
  if (body.folder !== undefined) {
    if (!isValidFolder(body.folder)) return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
    data.folder = body.folder as DocumentFolder;
  }
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
  if (body.isConfidential !== undefined) data.isConfidential = body.isConfidential === true;

  await prisma.customerDocument.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await ownDoc(admin.organizationId, id);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.customerDocument.delete({ where: { id } });

  await logTeamActivity({
    organizationId: admin.organizationId,
    actorId: admin.id,
    actorName: admin.name ?? admin.email,
    action: "DOCUMENT_DELETED",
    module: "DOCUMENT",
    metadata: { customerId: doc.customerId, displayName: doc.displayName },
    ipAddress: clientIpFrom(req),
  });

  return NextResponse.json({ ok: true });
}
