export const runtime = "nodejs";

// ============================================================
// POST /api/invoices/[id]/send — email the invoice (PDF attached)
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { requirePermission } from "@/lib/auth/middleware";
import { renderInvoicePdfBuffer } from "@/lib/pdf/generateInvoicePdf";
import { sendEmail, buildInvoiceEmail } from "@/lib/notifications/email";
import { getInvoiceAppearance } from "@/lib/invoices/appearance";
import { logInvoiceActivity } from "@/lib/invoices/activity";
import { formatCurrency } from "@/lib/formatters/currency";
import { generateShareToken } from "@/lib/invoices/share";
import { appUrl } from "@/lib/url";

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
    // A missing link must not block delivery — log and send without it.
    console.error("[INVOICE_SEND] Could not resolve share link:", err);
    return undefined;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validEmails = (arr: unknown): string[] =>
  Array.isArray(arr) ? arr.filter((e): e is string => typeof e === "string" && EMAIL_RE.test(e)) : [];

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
    const body = await req.json();
    const to = typeof body.to === "string" && EMAIL_RE.test(body.to) ? body.to : null;
    if (!to) return NextResponse.json({ error: "A valid recipient email is required" }, { status: 400 });

    const cc = validEmails(body.cc);
    const bcc = validEmails(body.bcc);
    const message = typeof body.message === "string" ? body.message : undefined;

    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { customer: { select: { name: true } } },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // Caller may pass an explicit link; otherwise mint/reuse a public one.
    const shareUrl =
      typeof body.shareUrl === "string" && body.shareUrl.trim()
        ? body.shareUrl.trim()
        : await ensureShareUrl(id, organizationId);

    const [profile, org, appearance] = await Promise.all([
      prisma.businessProfile.findUnique({ where: { organizationId }, select: { businessName: true } }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      getInvoiceAppearance(organizationId),
    ]);
    const businessName = profile?.businessName ?? org?.name ?? "Your Company";

    // Render the PDF fresh and attach it.
    const { buffer, pdfFileName } = await renderInvoicePdfBuffer(id, organizationId);

    const subject =
      typeof body.subject === "string" && body.subject.trim()
        ? body.subject.trim()
        : `Invoice ${invoice.invoiceNumber} from ${businessName}`;

    const html = buildInvoiceEmail({
      customerName: invoice.customer.name,
      businessName,
      invoiceNumber: invoice.invoiceNumber,
      amountDue: formatCurrency(Number(invoice.balanceDue), invoice.currency),
      dueDate: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(invoice.dueDate),
      message,
      shareUrl,
      accent: appearance.accentColor,
    });

    const result = await sendEmail({
      to,
      cc,
      bcc,
      subject,
      html,
      attachments: [{ filename: pdfFileName, content: buffer.toString("base64") }],
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Failed to send email" }, { status: 502 });
    }

    // Mark as sent (only advance from DRAFT) and log the activity.
    if (invoice.status === "DRAFT") {
      await prisma.invoice.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    } else {
      await prisma.invoice.update({ where: { id }, data: { sentAt: new Date() } });
    }

    await logInvoiceActivity({
      invoiceId: id,
      organizationId,
      type: "EMAIL_SENT",
      message: `Invoice emailed to ${to}`,
      metadata: { to, cc, bcc },
      actorName,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[INVOICE_SEND]", error);
    const message = error instanceof Error ? error.message : "Failed to send invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
