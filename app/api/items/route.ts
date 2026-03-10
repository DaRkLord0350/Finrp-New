import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createItem, getItems } from "@/services/itemService";

// GET /api/items — list all items for the org
export async function GET() {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const items = await getItems(orgId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/items]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/items — create a new item
export async function POST(req: Request) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, stock, lowStockAt } = body;

    if (!name || stock === undefined || lowStockAt === undefined) {
      return NextResponse.json(
        { error: "name, stock, and lowStockAt are required" },
        { status: 400 }
      );
    }

    const item = await createItem({
      name,
      description: description || null,
      stock: Number(stock),
      lowStockAt: Number(lowStockAt),
      organizationId: orgId,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/items]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
