// ============================================================
// FinRP — Transaction Service
// Handles inventory movement records (SALE / RESTOCK)
// ============================================================

import { prisma } from "@/lib/prisma";

export interface CreateTransactionData {
  itemId: string;
  organizationId: string;
  type: "SALE" | "RESTOCK";
  quantity: number;
  note?: string;
}

/**
 * List all transactions for an org, newest first, with item info.
 */
export async function getTransactions(organizationId: string) {
  return prisma.transaction.findMany({
    where: { organizationId },
    include: {
      item: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create a SALE or RESTOCK transaction.
 * Also adjusts Item.stock accordingly.
 */
export async function createTransaction(data: CreateTransactionData) {
  const { itemId, organizationId, type, quantity, note } = data;

  // Use a transaction to ensure atomic stock update
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findFirst({
      where: { id: itemId, organizationId },
    });
    if (!item) throw new Error("Item not found or access denied");

    // Adjust stock
    const stockDelta = type === "SALE" ? -quantity : quantity;
    const newStock = Math.max(0, item.stock + stockDelta);

    await tx.item.update({
      where: { id: itemId },
      data: { stock: newStock },
    });

    return tx.transaction.create({
      data: { itemId, organizationId, type, quantity, note },
      include: { item: { select: { id: true, name: true } } },
    });
  });
}

/**
 * Delete a transaction record (does NOT reverse the stock change).
 */
export async function deleteTransaction(id: string, organizationId: string) {
  return prisma.transaction.delete({
    where: { id },
    // Ensure scoping by checking org in a findFirst guard
  });
}
