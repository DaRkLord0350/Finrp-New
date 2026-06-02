// ============================================================
// /api/customers
// GET  — cursor-paginated list with optional search
// POST — create customer
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

// ---------------------------------------------------------------------------
// GET /api/customers?cursor=<id>&take=<n>&q=<search>
// Returns { data, nextCursor, hasMore }
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const cursor  = url.searchParams.get("cursor") ?? undefined;
    const take    = Math.min(parseInt(url.searchParams.get("take") ?? "25", 10), 100);
    const search  = url.searchParams.get("q")?.trim() ?? "";
    const isActive = url.searchParams.get("active"); // "true" | "false" | null

    const where = {
      organizationId: tenantId,
      ...(isActive !== null && { isActive: isActive === "true" }),
      ...(search && {
        OR: [
          { name:    { contains: search, mode: "insensitive" as const } },
          { email:   { contains: search, mode: "insensitive" as const } },
          { company: { contains: search, mode: "insensitive" as const } },
          { phone:   { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    // Fetch one extra to determine hasMore
    const rows = await prisma.customer.findMany({
      where,
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
      select: {
        id:               true,
        name:             true,
        email:            true,
        phone:            true,
        company:          true,
        customerType:     true,
        totalPurchases:   true,
        outstandingAmount: true,
        creditLimit:      true,
        isActive:         true,
        tags:             true,
        createdAt:        true,
        _count: { select: { invoices: true } },
      },
    });

    const hasMore = rows.length > take;
    const data    = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({ data, nextCursor, hasMore });
  } catch (error) {
    console.error("[CUSTOMERS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/customers — create a new customer
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, email, phone, company, address, notes, customerType, gstin, creditLimit } = body;
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone,
        company,
        address,
        notes,
        customerType: customerType ?? "INDIVIDUAL",
        gstin,
        creditLimit: creditLimit ?? 0,
        organizationId: tenantId,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: unknown) {
    console.error("[CUSTOMERS_POST]", error);
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2003") {
      return NextResponse.json(
        { error: "Invalid organization. Please ensure your account is properly set up." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
