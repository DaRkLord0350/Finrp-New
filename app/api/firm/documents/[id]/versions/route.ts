import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";

async function getFirmUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || !["CA_FIRM_ADMIN", "CA"].includes(user.userRole ?? "")) return null;
  return user;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getFirmUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const document = await prisma.complianceDocument.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { id: true, fileName: true, version: true, reviewStatus: true },
  });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    orderBy: { versionNumber: "desc" },
  });

  return NextResponse.json({ document, versions });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getFirmUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const document = await prisma.complianceDocument.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { fileUrl, fileName, fileSize, notes } = body;
  if (!fileUrl || !fileName) return NextResponse.json({ error: "fileUrl and fileName are required" }, { status: 400 });

  // Determine next version number
  const lastVersion = await prisma.documentVersion.findFirst({
    where: { documentId: id },
    orderBy: { versionNumber: "desc" },
  });
  const nextVersion = (lastVersion?.versionNumber ?? document.version) + 1;

  const version = await prisma.$transaction(async (tx) => {
    const v = await tx.documentVersion.create({
      data: {
        documentId: id,
        versionNumber: nextVersion,
        fileUrl,
        fileName,
        fileSize: fileSize ?? 0,
        uploadedById: user.id,
        notes: notes?.trim() || null,
      },
    });

    // Update parent document version number
    await tx.complianceDocument.update({
      where: { id },
      data: { version: nextVersion, reviewStatus: "PENDING" },
    });

    return v;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "UPDATE",
    entity: "compliance_document",
    entityId: id,
    description: `Uploaded version ${nextVersion} of document ${document.fileName}`,
  });

  return NextResponse.json({ version }, { status: 201 });
}
