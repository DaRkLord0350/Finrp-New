export const runtime = "nodejs";

// ============================================================
// POST /api/invoices/[id]/send — queue the invoice for delivery
//
// PDF rendering + email delivery are offloaded to the invoice-pdf
// Inngest function so the request never blocks on rendering. The
// invoice is marked SENT optimistically and the email (with the freshly
// rendered PDF attached) is delivered in the background with retries.
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { logInvoiceActivity } from "@/lib/invoices/activity";
import { generateShareToken } from "@/lib/invoices/share";
import { appUrl } from "@/lib/url";
import { inngest } from "@/inngest/client";
import { EVENTS } from "@/inngest/events";

// Reuse a live public link for the invoice, or mint one, so every
// emailed invoice carries a working "View Invoice Online" / pay link.
async function ensureShareUrl(invoiceId: string, organizationId: string): Promise<string | undefined> {
  try {
    let link = await prisma.invoiceShareLink.findFirst({
      where: {
        invoiceId,
        organizationId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      select: { token: true },
    });
    if (!link) {
      link = await prisma.invoiceShareLink.create({
        data: { invoiceId, organizationId, token: generateShareToken() },
        select: { token: true },
      });
    }
    return appUrl(`/i/${link.token}`);
  } catch (err) {
    console.error("[INVOICE_SEND] Could not resolve share link:", err);
    return undefined;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validEmails = (arr: unknown): string[] =>
  Array.isArray(arr) ? arr.filter((e): e is string => typeof e === "string" && EMAIL_RE.test(e)) : [];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const body = await req.json();
    const to = typeof body.to === "string" && EMAIL_RE.test(body.to) ? body.to : null;
    if (!to) return NextResponse.json({ error: "A valid recipient email is required" }, { status: 400 });

    const cc = validEmails(body.cc);
    const bcc = validEmails(body.bcc);
    const message = typeof body.message === "string" ? body.message : undefined;
    const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : undefined;

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // Caller may pass an explicit link; otherwise mint/reuse a public one.
    const shareUrl =
      typeof body.shareUrl === "string" && body.shareUrl.trim()
        ? body.shareUrl.trim()
        : await ensureShareUrl(id, organizationId);

    // Optimistically advance status (only from DRAFT) and record intent.
    if (invoice.status === "DRAFT") {
      await prisma.invoice.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    } else {
      await prisma.invoice.update({ where: { id }, data: { sentAt: new Date() } });
    }

    await logInvoiceActivity({
      invoiceId: id,
      organizationId,
      type: "EMAIL_SENT",
      message: `Invoice queued for delivery to ${to}`,
      metadata: { to, cc, bcc, queued: true },
      actorName,
    });

    // Offload PDF render + email delivery to Inngest (never blocks the UI).
    await inngest.send({
      name: EVENTS.INVOICE_PDF_GENERATE,
      data: {
        invoiceId: id,
        organizationId,
        deliver: true,
        recipientEmail: to,
        cc,
        bcc,
        subject,
        message,
        shareUrl,
        actorName,
      },
    });

    return NextResponse.json({ success: true, queued: true });
  } catch (error) {
    console.error("[INVOICE_SEND]", error);
    const message = error instanceof Error ? error.message : "Failed to send invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
