// ============================================================
// POST /api/firm/vault/[id]/download
//   Records a download in DocumentDownloadLog and returns the
//   current file URL for the client to open.
//
// RBAC: CA_FIRM_ADMIN only, scoped to the admin's organization.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirmAdminApi } from "@/lib/auth/firm-admin";
import { clientIpFrom } from "@/lib/team/activity";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getFirmAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.customerDocument.findFirst({
    where: { id, organizationId: admin.organizationId },
    select: { id: true, fileUrl: true, fileName: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await prisma.documentDownloadLog.create({
    data: {
      documentId: id,
      organizationId: admin.organizationId,
      userId: admin.id,
      userName: admin.name ?? admin.email,
      ipAddress: clientIpFrom(req),
    },
  });

  return NextResponse.json({ fileUrl: doc.fileUrl, fileName: doc.fileName });
}
