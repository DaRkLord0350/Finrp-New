import { prisma } from "@/lib/prisma";

export interface CreateItemData {
  name: string;
  description?: string;
  stock: number;
  lowStockAt: number;
  organizationId: string;
}

export interface UpdateItemData {
  name?: string;
  description?: string;
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
  return prisma.item.update({
    where: { id },
    data,
  });
}

export async function deleteItem(id: string, organizationId: string) {
  return prisma.item.delete({
    where: { id },
  });
}
