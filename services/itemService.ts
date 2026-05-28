import { prisma } from "@/lib/prisma";
// import type { Prisma.Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────
// NOTE: The form layer (ItemForm + itemSchema) uses `price`
// as the field name. The Prisma Item model stores it as
// `sellingPrice`. All create/update operations map here.
// ─────────────────────────────────────────────────────────

export interface CreateItemData {
  name: string;
  description?: string;
  /** Maps to Item.sellingPrice */
  price?: number | Prisma.Decimal;
  stock: number;
  lowStockAt: number;
  organizationId: string;
}

export interface UpdateItemData {
  name?: string;
  description?: string;
  /** Maps to Item.sellingPrice */
  price?: number | Prisma.Decimal;
  stock?: number;
  lowStockAt?: number;
}

export async function getItems(organizationId: string) {
  return prisma.item.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getItemById(id: string, organizationId: string) {
  return prisma.item.findFirst({
    where: { id, organizationId },
  });
}

export async function createItem(data: CreateItemData) {
  // Destructure `price` out and map it to `sellingPrice`
  const { price, ...rest } = data;
  return prisma.item.create({
    data: {
      ...rest,
      sellingPrice: price ?? 0,
    },
  });
}

export async function updateItem(
  id: string,
  organizationId: string,
  data: UpdateItemData
) {
  // Map `price` → `sellingPrice` and strip undefined values
  const { price, ...rest } = data;

  const mapped = {
    ...rest,
    ...(price !== undefined ? { sellingPrice: price } : {}),
  };

  const cleanData = Object.fromEntries(
    Object.entries(mapped).filter(([, v]) => v !== undefined)
  );

  return prisma.item.update({
    where: { id },
    data: cleanData,
  });
}

export async function deleteItem(id: string, organizationId: string) {
  return prisma.item.delete({
    where: { id },
  });
}
