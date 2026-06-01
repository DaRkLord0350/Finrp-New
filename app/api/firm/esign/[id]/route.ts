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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const request = await prisma.signatureRequest.findFirst({
    where: { id, organizationId: admin.organizationId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ request });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.signatureRequest.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { status, event, eventDescription, signedDocUrl, rejectionReason } = body;

  const now = new Date();
  const statusTimestamps: Record<string, Record<string, Date>> = {
    SENT: { sentAt: now },
    VIEWED: { viewedAt: now },
    SIGNED: { signedAt: now },
    REJECTED: { rejectedAt: now },
  };

  const updated = await prisma.$transaction(async (tx) => {
    const req = await tx.signatureRequest.update({
      where: { id },
      data: {
        ...(status && { status, ...statusTimestamps[status] }),
        ...(signedDocUrl && { signedDocUrl }),
        ...(rejectionReason && { rejectionReason }),
      },
    });

    if (event) {
      await tx.signatureEvent.create({
        data: {
          signatureRequestId: id,
          event,
          description: eventDescription || null,
          metadata: { updatedBy: admin.id, timestamp: now.toISOString() },
        },
      });
    }

    return req;
  });

  await createAuditLog({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "UPDATE",
    entity: "signature_request",
    entityId: id,
    description: `Updated signature request status to ${status ?? "updated"}`,
  });

  return NextResponse.json({ request: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.signatureRequest.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.signatureRequest.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
