// ============================================================
// /api/portal/filings
//   GET  → list filing approvals (firm/CA scoped; customer: own)
//   POST → CA creates a filing approval (optionally with documents)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireFirmSide, requireCustomer } from "@/lib/client-portal/auth";
import { assignedCustomerIds } from "@/lib/client-portal/context";
import { listFilingApprovals } from "@/lib/client-portal/queries";
import { createFilingApproval } from "@/lib/client-portal/service";

export async function GET() {
  const firm = await requireFirmSide();
  if (firm) {
    const caId = firm.userRole === "CA" ? firm.id : undefined;
    const customerIds = caId ? await assignedCustomerIds(caId) : undefined;
    const rows = await listFilingApprovals(firm.organizationId, { caId, customerIds });
    return NextResponse.json({ filings: rows });
  }

  const customer = await requireCustomer();
  if (customer) {
    const rows = await listFilingApprovals(customer.ctx.organizationId, {
      customerId: customer.ctx.customerId,
    });
    return NextResponse.json({ filings: rows });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const actor = await requireFirmSide();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const result = await createFilingApproval(actor, {
    customerId: String(body.customerId ?? ""),
    type: body.type ?? undefined,
    title: String(body.title ?? ""),
    period: body.period ?? null,
    summary: body.summary ?? null,
    amount: typeof body.amount === "number" ? body.amount : null,
    documents: Array.isArray(body.documents) ? body.documents : undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ filing: result.data }, { status: 201 });
}
