// ============================================================
// /api/customers
// GET  — cursor-paginated list with optional search
// POST — create customer
// ============================================================

import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/require-tenant";
import { customerRepository } from "@/lib/repositories/customer.repository";

// ---------------------------------------------------------------------------
// GET /api/customers?cursor=<id>&take=<n>&q=<search>&active=<bool>
// ---------------------------------------------------------------------------
export const GET = withTenant(async (req, { organizationId }) => {
  const url = new URL(req.url);
  const cursor  = url.searchParams.get("cursor") ?? undefined;
  const take    = Math.min(parseInt(url.searchParams.get("take") ?? "25", 10), 100);
  const q       = url.searchParams.get("q")?.trim() ?? undefined;
  const activeParam = url.searchParams.get("active");
  const active  = activeParam === null ? null : activeParam === "true";

  const result = await customerRepository.list(organizationId, {
    cursor, take, q,
    active: active ?? undefined,
  });

  return NextResponse.json(result);
});

// ---------------------------------------------------------------------------
// POST /api/customers — create a new customer
// ---------------------------------------------------------------------------
export const POST = withTenant(async (req, { organizationId }) => {
  const body = await req.json();
  const { name, email, phone, company, address, notes, customerType, gstin, creditLimit } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const customer = await customerRepository.create(organizationId, {
      name, email, phone, company, address, notes,
      customerType: customerType ?? "INDIVIDUAL",
      gstin,
      creditLimit: creditLimit ?? 0,
    } as Parameters<typeof customerRepository.create>[1]);

    return NextResponse.json(customer, { status: 201 });
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr?.code === "P2003") {
      return NextResponse.json(
        { error: "Invalid organization. Please ensure your account is properly set up." },
        { status: 400 }
      );
    }
    throw err; // re-throw for withTenant to handle
  }
});
