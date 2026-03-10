"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Package, RefreshCw } from "lucide-react";
import ItemTable from "@/components/ItemTable";
import ItemForm from "@/components/ItemForm";

interface Item {
  id: string;
  name: string;
  description?: string | null;
  stock: number;
  lowStockAt: number;
  updatedAt: string;
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/items");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      console.error("Failed to load items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      alert("Failed to delete item. Please try again.");
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  const handleFormSuccess = () => {
    fetchItems();
  };

  // Stats
  const lowStockCount = items.filter((i) => i.stock < i.lowStockAt).length;
  const runningLowCount = items.filter(
    (i) => i.stock >= i.lowStockAt && i.stock < i.lowStockAt * 2
  ).length;
  const healthyCount = items.filter((i) => i.stock >= i.lowStockAt * 2).length;

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            Inventory Catalog
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            Manage your product and service catalog with real-time stock tracking.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={fetchItems}
            className="btn-ghost"
            style={{ padding: "8px 12px" }}
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          <button onClick={handleAddNew} className="btn-brand">
            <Plus size={15} />
            Add Item
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div
        className="stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Total Items",
            value: loading ? "—" : items.length,
            color: "#818cf8",
            bg: "rgba(99,102,241,0.08)",
          },
          {
            label: "In Stock",
            value: loading ? "—" : healthyCount,
            color: "#10b981",
            bg: "rgba(16,185,129,0.08)",
          },
          {
            label: "Running Low",
            value: loading ? "—" : runningLowCount,
            color: "#f59e0b",
            bg: "rgba(245,158,11,0.08)",
          },
          {
            label: "Low Stock",
            value: loading ? "—" : lowStockCount,
            color: "#ef4444",
            bg: "rgba(239,68,68,0.08)",
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            className="stat-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {stat.label}
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, color: stat.color, marginTop: 6 }}>
              {stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Items Table */}
      <motion.div
        className="surface"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        style={{ overflow: "hidden" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(99,102,241,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Package size={16} color="var(--brand-400)" />
            </div>
            <div>
              <h3 className="section-title" style={{ fontSize: 15 }}>
                All Items
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {items.length} item{items.length !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 24px",
              gap: 10,
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            <RefreshCw
              size={16}
              style={{ animation: "spin 1s linear infinite" }}
            />
            Loading inventory...
          </div>
        ) : (
          <ItemTable
            items={items}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </motion.div>

      {/* Item Form Modal */}
      {showForm && (
        <ItemForm
          item={editingItem}
          onSuccess={handleFormSuccess}
          onClose={handleFormClose}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
