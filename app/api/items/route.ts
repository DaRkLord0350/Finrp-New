// ============================================================
// GET  /api/items  — list all items for the org
// POST /api/items  — create a new item
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createItem, getItems } from "@/services/itemService";
import { itemSchema } from "@/lib/validations";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = await getTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const items = await getItems(tenantId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/items]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = await getTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, description, price, stock, lowStockAt } = parsed.data;

    const item = await createItem({
      name,
      description: description ?? undefined,
      price,
      stock,
      lowStockAt,
      organizationId: tenantId,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/items]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
