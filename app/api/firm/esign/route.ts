import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";

async function getFirmAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.userRole !== "CA_FIRM_ADMIN") return null;
  return user;
}

export async function GET() {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.signatureRequest.findMany({
    where: { organizationId: admin.organizationId },
    include: { events: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, documentUrl, signerEmail, signerName, caEmail, expiresAt } = body;

  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!documentUrl) return NextResponse.json({ error: "documentUrl is required" }, { status: 400 });
  if (!signerEmail) return NextResponse.json({ error: "signerEmail is required" }, { status: 400 });

  const request = await prisma.signatureRequest.create({
    data: {
      organizationId: admin.organizationId,
      title: title.trim(),
      description: description?.trim() || null,
      documentUrl,
      signerEmail,
      signerName: signerName?.trim() || null,
      caEmail: caEmail?.trim() || null,
      caId: admin.id,
      status: "PENDING",
      createdById: admin.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: { events: true },
  });

  await createAuditLog({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "CREATE",
    entity: "signature_request",
    entityId: request.id,
    description: `Created signature request: ${title} for ${signerEmail}`,
  });

  return NextResponse.json({ request }, { status: 201 });
}
