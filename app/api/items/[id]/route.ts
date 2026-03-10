// ============================================================
// PATCH  /api/items/[id]  — update an item
// DELETE /api/items/[id]  — remove an item
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { updateItem, deleteItem } from "@/services/itemService";
import { itemSchema } from "@/lib/validations";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = orgId ?? userId;
    const { id } = await params;
    const body = await req.json();

    // Partial validation — allow partial updates
    const parsed = itemSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const item = await updateItem(id, tenantId, {
      name: parsed.data.name,
      description: parsed.data.description,
      price: parsed.data.price,
      stock: parsed.data.stock,
      lowStockAt: parsed.data.lowStockAt,
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("[PATCH /api/items/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Also support PUT for form compatibility
export { PATCH as PUT };

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = orgId ?? userId;
    const { id } = await params;
    await deleteItem(id, tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/items/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
