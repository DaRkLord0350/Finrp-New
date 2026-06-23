// ============================================================
// /api/portal/document-requests
//   GET  → list (firm/CA: scoped to firm org & assignments;
//                customer: their own requests)
//   POST → CA creates a document request for a customer
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { requireFirmSide, requireCustomer } from "@/lib/client-portal/auth";
import { assignedCustomerIds } from "@/lib/client-portal/context";
import { listDocumentRequests } from "@/lib/client-portal/queries";
import { createDocumentRequest } from "@/lib/client-portal/service";

export async function GET() {
  const firm = await requireFirmSide();
  if (firm) {
    const caId = firm.userRole === "CA" ? firm.id : undefined;
    const customerIds = caId ? await assignedCustomerIds(caId) : undefined;
    const rows = await listDocumentRequests(firm.organizationId, { caId, customerIds });
    return NextResponse.json({ requests: rows });
  }

  const customer = await requireCustomer();
  if (customer) {
    const rows = await listDocumentRequests(customer.ctx.organizationId, {
      customerId: customer.ctx.customerId,
    });
    return NextResponse.json({ requests: rows });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const actor = await requireFirmSide();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const result = await createDocumentRequest(actor, {
    customerId: String(body.customerId ?? ""),
    title: String(body.title ?? ""),
    description: body.description ?? null,
    category: body.category ?? undefined,
    dueDate: body.dueDate ?? null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ request: result.data }, { status: 201 });
}
