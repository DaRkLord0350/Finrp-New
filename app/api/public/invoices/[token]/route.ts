export const runtime = "nodejs";

// ============================================================
// Public (no-auth) invoice access by share token.
//   GET  /api/public/invoices/[token]          — open links / password check
//   POST /api/public/invoices/[token] {password} — unlock protected links
// Authorized purely by token possession (+ optional password).
// ============================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInvoiceAppearance } from "@/lib/invoices/appearance";
import { verifySharePassword, isShareLinkExpired } from "@/lib/invoices/share";
import { logInvoiceActivity } from "@/lib/invoices/activity";
import { qrDataUrl } from "@/lib/invoices/qr";

const VIEW_LOG_THROTTLE_MS = 30 * 60 * 1000;

async function loadLink(token: string) {
  return prisma.invoiceShareLink.findUnique({ where: { token } });
}

async function buildPayload(
  link: NonNullable<Awaited<ReturnType<typeof loadLink>>>,
  origin: string
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: link.invoiceId, organizationId: link.organizationId },
    include: { items: true, customer: true },
  });
  if (!invoice) return null;

  const [profile, appearance] = await Promise.all([
    prisma.businessProfile.findUnique({ where: { organizationId: link.organizationId } }),
    getInvoiceAppearance(link.organizationId),
  ]);

  const cityLine = [profile?.city, profile?.state, profile?.country].filter(Boolean).join(", ") || null;

  const data = {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    business: {
      name: profile?.businessName ?? "Company",
      address: profile?.address ?? null,
      cityLine,
      gstin: profile?.gstin ?? profile?.taxId ?? null,
      pan: profile?.pan ?? null,
      email: profile?.contactEmail ?? null,
      phone: profile?.contactPhone ?? null,
      website: profile?.website ?? null,
      logoUrl: appearance.logoUrl ?? profile?.logoUrl ?? null,
    },
    customer: {
      name: invoice.customer.name,
      company: invoice.customer.company,
      email: invoice.customer.email,
      phone: invoice.customer.phone,
      address: invoice.customer.address,
      gstin: invoice.customer.gstin,
    },
    items: invoice.items.map((it) => ({
      description: it.description,
      sku: it.sku,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      discount: Number(it.discount),
      taxPercent: Number(it.taxPercent),
      amount: Number(it.amount),
    })),
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    shipping: Number(invoice.shipping),
    taxRate: Number(invoice.taxRate),
    taxAmount: Number(invoice.taxAmount),
    total: Number(invoice.total),
    paidAmount: Number(invoice.paidAmount),
    balanceDue: Number(invoice.balanceDue),
    notes: invoice.notes,
    terms: invoice.terms,
  };

  // Record the view (count always; timeline entry throttled to avoid spam).
  const shouldLog =
    !link.lastViewedAt || Date.now() - link.lastViewedAt.getTime() > VIEW_LOG_THROTTLE_MS;
  await prisma.invoiceShareLink.update({
    where: { id: link.id },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  });
  if (shouldLog) {
    await logInvoiceActivity({
      invoiceId: invoice.id,
      organizationId: link.organizationId,
      type: "VIEWED",
      message: "Invoice viewed via share link",
    });
  }

  const qr = appearance.showQr ? await qrDataUrl(`${origin}/i/${link.token}`, { size: 220 }) : null;

  return { requiresPassword: false as const, invoice: data, appearance, qr };
}

function linkError(link: Awaited<ReturnType<typeof loadLink>>) {
  if (!link || !link.isActive) return NextResponse.json({ error: "This link is no longer available." }, { status: 404 });
  if (isShareLinkExpired(link.expiresAt)) return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const link = await loadLink(token);
    const err = linkError(link);
    if (err) return err;

    if (link!.passwordHash) {
      return NextResponse.json({ requiresPassword: true });
    }

    const origin = new URL(req.url).origin;
    const payload = await buildPayload(link!, origin);
    if (!payload) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[PUBLIC_INVOICE_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const link = await loadLink(token);
    const err = linkError(link);
    if (err) return err;

    const body = await req.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";
    if (!verifySharePassword(password, link!.passwordHash)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const origin = new URL(req.url).origin;
    const payload = await buildPayload(link!, origin);
    if (!payload) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[PUBLIC_INVOICE_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
