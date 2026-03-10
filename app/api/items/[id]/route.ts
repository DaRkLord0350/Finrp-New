import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { updateItem, deleteItem } from "@/services/itemService";

// PATCH /api/items/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();

    const item = await updateItem(id, orgId, {
      name: body.name,
      description: body.description ?? undefined,
      stock: body.stock !== undefined ? Number(body.stock) : undefined,
      lowStockAt: body.lowStockAt !== undefined ? Number(body.lowStockAt) : undefined,
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("[PATCH /api/items/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/items/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await deleteItem(id, orgId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/items/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
