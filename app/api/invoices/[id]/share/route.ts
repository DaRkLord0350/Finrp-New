// ============================================================
// GET  /api/invoices/[id]/share  — list share links for an invoice
// POST /api/invoices/[id]/share  — create a new share link
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { generateShareToken, hashSharePassword } from "@/lib/invoices/share";
import { logInvoiceActivity } from "@/lib/invoices/activity";

// Never leak passwordHash to the client; expose a boolean instead.
function publicShape(link: {
  id: string;
  token: string;
  passwordHash: string | null;
  expiresAt: Date | null;
  isActive: boolean;
  viewCount: number;
  lastViewedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: link.id,
    token: link.token,
    hasPassword: !!link.passwordHash,
    expiresAt: link.expiresAt,
    isActive: link.isActive,
    viewCount: link.viewCount,
    lastViewedAt: link.lastViewedAt,
    createdAt: link.createdAt,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const links = await prisma.invoiceShareLink.findMany({
      where: { invoiceId: id, organizationId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ links: links.map(publicShape) });
  } catch (error) {
    console.error("[INVOICE_SHARE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let actorName: string | null = null;
    try {
      const { user } = await requirePermission("invoices.write");
      actorName = user.name;
    } catch (authErr) {
      if (authErr instanceof NextResponse) return authErr;
      throw authErr;
    }

    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      select: { id: true, invoiceNumber: true },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const expiresInDays = Number(body.expiresInDays);
    const expiresAt =
      Number.isFinite(expiresInDays) && expiresInDays > 0
        ? new Date(Date.now() + expiresInDays * 86400000)
        : null;
    const password = typeof body.password === "string" && body.password.trim() ? body.password.trim() : null;

    const link = await prisma.invoiceShareLink.create({
      data: {
        invoiceId: id,
        organizationId,
        token: generateShareToken(),
        passwordHash: password ? hashSharePassword(password) : null,
        expiresAt,
      },
    });

    await logInvoiceActivity({
      invoiceId: id,
      organizationId,
      type: "SHARED",
      message: `Share link created${expiresAt ? " (expiring)" : ""}${password ? " (password protected)" : ""}`,
      actorName,
    });

    return NextResponse.json({ link: publicShape(link) }, { status: 201 });
  } catch (error) {
    console.error("[INVOICE_SHARE_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
