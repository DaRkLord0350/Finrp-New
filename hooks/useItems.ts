"use client";

// ============================================================
// useItems — Full CRUD hook for the inventory catalog
// ============================================================

import { useState, useEffect, useCallback } from "react";

export interface Item {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  lowStockAt: number;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateItemInput = Omit<Item, "id" | "organizationId" | "createdAt" | "updatedAt">;
export type UpdateItemInput = Partial<CreateItemInput>;

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/items");
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const createItem = async (input: CreateItemInput): Promise<Item> => {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to create item");
    }
    const data = await res.json();
    const newItem = data.item as Item;
    setItems((prev) => [newItem, ...prev]);
    return newItem;
  };

  const updateItem = async (id: string, input: UpdateItemInput): Promise<Item> => {
    const res = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to update item");
    }
    const data = await res.json();
    const updated = data.item as Item;
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    return updated;
  };

  const deleteItem = async (id: string): Promise<void> => {
    const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to delete item");
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Derived stats
  const lowStockItems = items.filter((i) => i.stock < i.lowStockAt);
  const runningLowItems = items.filter(
    (i) => i.stock >= i.lowStockAt && i.stock < i.lowStockAt * 2
  );
  const healthyItems = items.filter((i) => i.stock >= i.lowStockAt * 2);

  return {
    items,
    loading,
    error,
    refetch: fetchItems,
    createItem,
    updateItem,
    deleteItem,
    // stats
    lowStockCount: lowStockItems.length,
    runningLowCount: runningLowItems.length,
    healthyCount: healthyItems.length,
    lowStockItems,
  };
}
