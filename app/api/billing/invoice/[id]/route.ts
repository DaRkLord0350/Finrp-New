// ============================================================
// GET /api/billing/invoice/[id] — printable invoice for a payment
//
// Returns a styled, self-contained HTML invoice (with a Print / Save-as-
// PDF button). Only CAPTURED payments belonging to the caller's org are
// served. Browsers can save the page as PDF for download.
// ============================================================

import { NextResponse } from "next/server";
import { requireTenant, UnauthorizedError, ForbiddenError } from "@/lib/auth/require-tenant";
import { getInvoice } from "@/lib/services/billing.service";
import { getPlan, formatPrice } from "@/lib/billing/plans";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requireTenant({ permission: "settings.read" });
    const { id } = await params;
    const inv = await getInvoice(organizationId, id);
    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const plan = getPlan(inv.planType);
    const orgName = inv.organization.businessProfile?.businessName ?? inv.organization.name;
    const date = inv.createdAt.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
    const amount = formatPrice(Number(inv.amount));
    const period =
      inv.periodStart && inv.periodEnd
        ? `${inv.periodStart.toLocaleDateString("en-IN")} – ${inv.periodEnd.toLocaleDateString("en-IN")}`
        : "—";

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(inv.invoiceNumber ?? inv.id)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;max-width:720px;margin:32px auto;padding:0 24px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #6366f1;padding-bottom:16px}
  .brand{font-size:24px;font-weight:800;background:linear-gradient(135deg,#6366f1,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  table{width:100%;border-collapse:collapse;margin-top:24px}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase}
  .total{font-size:18px;font-weight:800}
  .muted{color:#64748b;font-size:13px}
  .badge{display:inline-block;padding:3px 10px;border-radius:99px;background:#dcfce7;color:#16a34a;font-size:12px;font-weight:700}
  @media print{.noprint{display:none}}
  .btn{display:inline-block;margin-top:24px;padding:10px 18px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
</style></head>
<body>
  <div class="head">
    <div><div class="brand">FinRP</div><p class="muted">CA Practice Management & Financial Operations</p></div>
    <div style="text-align:right">
      <div style="font-weight:700;font-size:18px">Invoice</div>
      <div class="muted">${esc(inv.invoiceNumber ?? inv.id)}</div>
      <div class="muted">${esc(date)}</div>
    </div>
  </div>

  <table>
    <tr><th>Billed to</th><th style="text-align:right">Status</th></tr>
    <tr>
      <td>${esc(orgName)}${inv.organization.businessProfile?.gstin ? `<br><span class="muted">GSTIN: ${esc(inv.organization.businessProfile.gstin)}</span>` : ""}</td>
      <td style="text-align:right"><span class="badge">PAID</span></td>
    </tr>
  </table>

  <table>
    <tr><th>Description</th><th>Period</th><th style="text-align:right">Amount</th></tr>
    <tr><td>${esc(plan.name)} plan — monthly subscription</td><td>${esc(period)}</td><td style="text-align:right">${esc(amount)}</td></tr>
    <tr><td colspan="2" class="total" style="text-align:right">Total paid</td><td class="total" style="text-align:right">${esc(amount)}</td></tr>
  </table>

  <p class="muted" style="margin-top:24px">Payment method: ${esc(inv.method ?? "—")} · Razorpay payment: ${esc(inv.razorpayPaymentId ?? "—")}</p>
  <p class="muted">Thank you for your business.</p>

  <button class="btn noprint" onclick="window.print()">Print / Save as PDF</button>
</body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error("[/api/billing/invoice/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
