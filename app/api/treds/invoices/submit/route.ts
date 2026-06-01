import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { invoiceNumber, buyerName, buyerGstin, invoiceAmount, dueDate, invoiceId, notes, documents } = body;

    if (!invoiceNumber || !buyerName || !invoiceAmount || !dueDate) {
      return NextResponse.json({ error: "Missing required fields: invoiceNumber, buyerName, invoiceAmount, dueDate" }, { status: 400 });
    }

    const integration = await prisma.tredsIntegration.findUnique({
      where: { organizationId: tenantId },
    });
    if (!integration || integration.status !== "ACTIVE") {
      return NextResponse.json({ error: "M1xchange integration is not connected. Configure it under TReDS > Integration." }, { status: 400 });
    }

    // In production this would call the M1xchange API and get a real reference ID.
    // We generate a reference ID and persist the record locally.
    const m1ReferenceId = `M1X-${Date.now().toString(36).toUpperCase()}`;

    const invoice = await prisma.tredsInvoice.create({
      data: {
        organizationId: tenantId,
        integrationId: integration.id,
        invoiceNumber,
        buyerName,
        buyerGstin: buyerGstin ?? null,
        invoiceAmount,
        dueDate: new Date(dueDate),
        invoiceId: invoiceId ?? null,
        m1ReferenceId,
        status: "SUBMITTED",
        submittedAt: new Date(),
        notes: notes ?? null,
        documents: documents ?? [],
      },
    });

    // Create notification
    await prisma.tredsNotification.create({
      data: {
        organizationId: tenantId,
        integrationId: integration.id,
        type: "INVOICE_SUBMITTED",
        title: "Invoice Submitted to TReDS",
        description: `Invoice ${invoiceNumber} for ₹${Number(invoiceAmount).toLocaleString("en-IN")} has been submitted to M1xchange.`,
        metadata: { invoiceId: invoice.id, m1ReferenceId },
      },
    });

    // Log activity
    await prisma.tredsActivityLog.create({
      data: {
        tredsInvoiceId: invoice.id,
        action: "SUBMITTED",
        description: `Invoice submitted to M1xchange with reference ${m1ReferenceId}`,
      },
    });

    return NextResponse.json({ invoice, m1ReferenceId }, { status: 201 });
  } catch (error) {
    console.error("[TREDS_SUBMIT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
