"use client";

import Link from "next/link";
import { Pencil, Trash2, Package } from "lucide-react";
import StockWarningBadge from "./StockWarningBadge";
import { useBreakpoint } from "@/hooks/useBreakpoint";

interface Item {
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

interface ItemTableProps {
  items: Item[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
}

function stockColor(stock: number, low: number) {
  if (stock < low) return "#ef4444";
  if (stock < low * 2) return "#f59e0b";
  return "#10b981";
}

export default function ItemTable({ items, onEdit, onDelete }: ItemTableProps) {
  const { isMobile, isTablet } = useBreakpoint();

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Package size={24} color="var(--brand-400)" />
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No items yet</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Add your first inventory item to get started.</p>
      </div>
    );
  }

  /* ── Mobile: card list ─────────────────────────────────────── */
  if (isMobile) {
    return (
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}
          >
            {/* Row 1: name + badge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <Link
                href={`/billing/items/${item.id}`}
                style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", flex: 1, marginRight: 10, textDecoration: "none" }}
              >
                {item.name}
              </Link>
              <StockWarningBadge stock={item.stock} lowStockAt={item.lowStockAt} />
            </div>

            {/* Row 2: description */}
            {item.description && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.description}
              </p>
            )}

            {/* Row 3: price / stock / threshold */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              <div>
                <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Price</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>${Number(item.price).toFixed(2)}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Stock</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: stockColor(item.stock, item.lowStockAt) }}>{item.stock}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Alert At</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>{item.lowStockAt}</p>
              </div>
            </div>

            {/* Row 4: actions */}
            <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <button
                onClick={() => onEdit(item)}
                style={{ flex: 1, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 7, padding: "7px 0", cursor: "pointer", color: "var(--brand-400)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 13, fontWeight: 500 }}
              >
                <Pencil size={13} /> Edit
              </button>
              <button
                onClick={() => { if (confirm(`Delete "${item.name}"? This cannot be undone.`)) onDelete(item.id); }}
                style={{ flex: 1, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, padding: "7px 0", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 13, fontWeight: 500 }}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ── Tablet / Desktop: table ───────────────────────────────── */
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table" style={{ minWidth: isTablet ? 560 : 700 }}>
        <thead>
          <tr>
            <th>Item Name</th>
            {!isTablet && <th>Description</th>}
            <th>Price</th>
            <th>Stock</th>
            {!isTablet && <th>Alert Threshold</th>}
            <th>Status</th>
            {!isTablet && <th>Last Updated</th>}
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div>
                  <Link
                    href={`/billing/items/${item.id}`}
                    style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14, textDecoration: "none" }}
                  >
                    {item.name}
                  </Link>
                  {isTablet && item.description && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                      {item.description}
                    </p>
                  )}
                </div>
              </td>
              {!isTablet && (
                <td>
                  <span style={{ color: "var(--text-muted)", fontSize: 13, maxWidth: 200, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.description || "—"}
                  </span>
                </td>
              )}
              <td>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>${Number(item.price).toFixed(2)}</span>
              </td>
              <td>
                <span style={{ fontWeight: 700, fontSize: 15, color: stockColor(item.stock, item.lowStockAt) }}>{item.stock}</span>
                {isTablet && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>/ {item.lowStockAt}</span>}
              </td>
              {!isTablet && (
                <td><span style={{ color: "var(--text-muted)", fontSize: 13 }}>{item.lowStockAt} units</span></td>
              )}
              <td><StockWarningBadge stock={item.stock} lowStockAt={item.lowStockAt} /></td>
              {!isTablet && (
                <td>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {new Date(item.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </td>
              )}
              <td>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                  <button
                    onClick={() => onEdit(item)}
                    style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 7, padding: "6px 8px", cursor: "pointer", color: "var(--brand-400)", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500 }}
                  >
                    <Pencil size={13} />
                    {!isTablet && "Edit"}
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${item.name}"? This cannot be undone.`)) onDelete(item.id); }}
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, padding: "6px 8px", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500 }}
                  >
                    <Trash2 size={13} />
                    {!isTablet && "Delete"}
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
