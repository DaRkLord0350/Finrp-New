import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createItem, getItems } from "@/services/itemService";
import { itemSchema } from "@/lib/validations";

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  try {
    const items = await getItems(organizationId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/items]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "inventory.read");

export const POST = withAuth(async (req: Request, { organizationId }) => {
  try {
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
      organizationId,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/items]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "inventory.write");
