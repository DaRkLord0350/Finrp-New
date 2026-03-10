import { prisma } from "@/lib/prisma";
import type { Decimal } from "@prisma/client/runtime/library";

export interface CreateItemData {
  name: string;
  description?: string;
  price?: number | Decimal;
  stock: number;
  lowStockAt: number;
  organizationId: string;
}

export interface UpdateItemData {
  name?: string;
  description?: string;
  price?: number | Decimal;
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
  return prisma.item.create({ data });
}

export async function updateItem(
  id: string,
  organizationId: string,
  data: UpdateItemData
) {
  // Remove undefined keys so Prisma doesn't overwrite with null
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as UpdateItemData;

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

