"use client";

import { Pencil, Trash2, Package } from "lucide-react";
import StockWarningBadge from "./StockWarningBadge";

interface Item {
  id: string;
  name: string;
  description?: string | null;
  stock: number;
  lowStockAt: number;
  updatedAt: string;
}

interface ItemTableProps {
  items: Item[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
}

export default function ItemTable({ items, onEdit, onDelete }: ItemTableProps) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "rgba(99,102,241,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <Package size={24} color="var(--brand-400)" />
        </div>
        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          No items yet
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Add your first inventory item to get started.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Description</th>
            <th>Stock</th>
            <th>Alert Threshold</th>
            <th>Status</th>
            <th>Last Updated</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                >
                  {item.name}
                </span>
              </td>
              <td>
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 13,
                    maxWidth: 240,
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.description || "—"}
                </span>
              </td>
              <td>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color:
                      item.stock < item.lowStockAt
                        ? "#ef4444"
                        : item.stock < item.lowStockAt * 2
                        ? "#f59e0b"
                        : "#10b981",
                  }}
                >
                  {item.stock}
                </span>
              </td>
              <td>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {item.lowStockAt} units
                </span>
              </td>
              <td>
                <StockWarningBadge stock={item.stock} lowStockAt={item.lowStockAt} />
              </td>
              <td>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {new Date(item.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </td>
              <td>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 6,
                  }}
                >
                  <button
                    onClick={() => onEdit(item)}
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      borderRadius: 7,
                      padding: "6px 8px",
                      cursor: "pointer",
                      color: "var(--brand-400)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${item.name}"? This cannot be undone.`)) {
                        onDelete(item.id);
                      }
                    }}
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 7,
                      padding: "6px 8px",
                      cursor: "pointer",
                      color: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
