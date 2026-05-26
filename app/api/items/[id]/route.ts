// ============================================================
// PATCH  /api/items/[id]  — update an item
// DELETE /api/items/[id]  — remove an item
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { updateItem, deleteItem } from "@/services/itemService";
import { itemSchema } from "@/lib/validations";

export const PATCH = withAuth(async (
  req: Request,
  { organizationId }
) => {
  try {
    // Extract params from the URL
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing item ID" }, { status: 400 });
    }

    const body = await req.json();

    // Partial validation — allow partial updates
    const parsed = itemSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const item = await updateItem(id, organizationId, {
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
}, "inventory.write");

// Also support PUT for form compatibility
export { PATCH as PUT };

export const DELETE = withAuth(async (
  req: Request,
  { organizationId }
) => {
  try {
    // Extract params from the URL
    const url = new URL(req.url);
    const id = url.pathname.split("/").pop();
    
    if (!id) {
      return NextResponse.json({ error: "Missing item ID" }, { status: 400 });
    }

    await deleteItem(id, organizationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/items/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "inventory.write");
