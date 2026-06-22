// ============================================================
// Inngest function — Invoice PDF generation (+ optional delivery)
// Replaces the synchronous PDF render in the invoice-send route so the
// UI request never blocks on rendering. Flow:
//   invoice/pdf.generate → render PDF → record metadata → (deliver)
//   email the customer with the PDF attached → log activity
//
// The email is sent from within this function (rather than re-emitting
// through email/send) to avoid pushing a base64 PDF through an event
// payload — but it still rides Inngest's durable retry budget.
// ============================================================

import { inngest } from "@/inngest/client";
import { EVENTS, type InvoicePdfGenerateEventData } from "@/inngest/events";
import { prisma } from "@/lib/prisma";
import { startBackgroundJob } from "@/lib/jobs/background-job";
import { renderInvoicePdfBuffer } from "@/lib/pdf/generateInvoicePdf";
import { sendEmail, buildInvoiceEmail } from "@/lib/notifications/email";
import { getInvoiceAppearance } from "@/lib/invoices/appearance";
import { logInvoiceActivity } from "@/lib/invoices/activity";
import { formatCurrency } from "@/lib/formatters/currency";

export const invoicePdf = inngest.createFunction(
  {
    id: "invoice-pdf-generate",
    name: "Invoice PDF Generation",
    concurrency: 5,
    retries: 3,
    triggers: [{ event: EVENTS.INVOICE_PDF_GENERATE }],
  },
  async ({ event, step, runId, attempt }) => {
    const data = event.data as InvoicePdfGenerateEventData;

    const bg = await startBackgroundJob({
      type: "invoice.pdf",
      organizationId: data.organizationId,
      referenceId: data.invoiceId,
      idempotencyKey: event.id ? `invoice.pdf:${event.id}` : `invoice.pdf:${data.invoiceId}`,
      eventName: event.name,
      eventId: event.id,
      runId,
      attempt: attempt + 1,
      metadata: { deliver: !!data.deliver },
    });

    try {
      // ── Render the PDF (durable, memoized across retries) ──
      const rendered = await step.run("render-pdf", async () => {
        const { buffer, pdfFileName } = await renderInvoicePdfBuffer(data.invoiceId, data.organizationId);
        return { base64: buffer.toString("base64"), pdfFileName };
      });

      await bg.setProgress(60);

      if (!data.deliver || !data.recipientEmail) {
        await bg.complete({ rendered: true, delivered: false });
        return { invoiceId: data.invoiceId, delivered: false };
      }

      // ── Build + send the delivery email (memoized so retries don't re-send) ──
      await step.run("send-invoice-email", async () => {
        const invoice = await prisma.invoice.findFirst({
          where: { id: data.invoiceId, organizationId: data.organizationId },
          include: { customer: { select: { name: true } } },
        });
        if (!invoice) throw new Error(`Invoice ${data.invoiceId} not found`);

        const [profile, org, appearance] = await Promise.all([
          prisma.businessProfile.findUnique({
            where: { organizationId: data.organizationId },
            select: { businessName: true },
          }),
          prisma.organization.findUnique({ where: { id: data.organizationId }, select: { name: true } }),
          getInvoiceAppearance(data.organizationId),
        ]);
        const businessName = profile?.businessName ?? org?.name ?? "Your Company";

        const subject =
          data.subject?.trim() || `Invoice ${invoice.invoiceNumber} from ${businessName}`;

        const html = buildInvoiceEmail({
          customerName: invoice.customer.name,
          businessName,
          invoiceNumber: invoice.invoiceNumber,
          amountDue: formatCurrency(Number(invoice.balanceDue), invoice.currency),
          dueDate: new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).format(invoice.dueDate),
          message: data.message,
          shareUrl: data.shareUrl,
          accent: appearance.accentColor,
        });

        const result = await sendEmail({
          to: data.recipientEmail!,
          cc: data.cc,
          bcc: data.bcc,
          subject,
          html,
          attachments: [{ filename: rendered.pdfFileName, content: rendered.base64 }],
        });
        if (!result.success) throw new Error(result.error ?? "Invoice email delivery failed");
      });

      await step.run("log-delivery", () =>
        logInvoiceActivity({
          invoiceId: data.invoiceId,
          organizationId: data.organizationId,
          type: "EMAIL_SENT",
          message: `Invoice emailed to ${data.recipientEmail}`,
          metadata: { to: data.recipientEmail, cc: data.cc ?? [], bcc: data.bcc ?? [] },
          actorName: data.actorName ?? null,
        })
      );

      await bg.complete({ rendered: true, delivered: true });
      return { invoiceId: data.invoiceId, delivered: true };
    } catch (err) {
      await bg.fail(err);
      throw err;
    }
  }
);
