// ============================================================
// PATCH  /api/items/[id]  — update an item
// DELETE /api/items/[id]  — remove an item
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { updateItem, deleteItem, getItemById } from "@/services/itemService";
import { itemSchema } from "@/lib/validations";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";

// GET /api/items/[id] — fetch a single item + its associated invoices.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = await getTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const item = await getItemById(id, tenantId);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Invoice line items reference catalog products by SKU (no FK relation),
    // so associated invoices can only be resolved when the item has a SKU.
    const invoices: Array<{
      id: string;
      invoiceNumber: string;
      status: string;
      total: number;
      createdAt: Date;
      customerName: string | null;
    }> = [];

    if (item.sku) {
      const lineItems = await prisma.invoiceItem.findMany({
        where: { sku: item.sku, invoice: { organizationId: tenantId, deletedAt: null } },
        select: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              total: true,
              createdAt: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { invoice: { createdAt: "desc" } },
      });

      const seen = new Set<string>();
      for (const li of lineItems) {
        if (seen.has(li.invoice.id)) continue;
        seen.add(li.invoice.id);
        invoices.push({
          id: li.invoice.id,
          invoiceNumber: li.invoice.invoiceNumber,
          status: li.invoice.status,
          total: Number(li.invoice.total),
          createdAt: li.invoice.createdAt,
          customerName: li.invoice.customer?.name ?? null,
        });
      }
    }

    // Map Prisma's `sellingPrice` back to the form-layer `price` field and
    // coerce Decimals to plain numbers so the client receives clean JSON.
    const payload = {
      id: item.id,
      name: item.name,
      description: item.description,
      sku: item.sku,
      barcode: item.barcode,
      category: item.category,
      unit: item.unit,
      price: Number(item.sellingPrice),
      costPrice: Number(item.costPrice),
      taxRate: Number(item.taxRate),
      stock: item.stock,
      lowStockAt: item.lowStockAt,
      reorderLevel: item.reorderLevel,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };

    return NextResponse.json({ item: payload, invoices });
  } catch (error) {
    console.error("[GET /api/items/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = await getTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tenantId = await getTenantId();
    if (!tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await deleteItem(id, tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/items/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
