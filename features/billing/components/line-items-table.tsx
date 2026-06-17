"use client";

import { motion } from "framer-motion";
import { Trash2, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";
import { ItemPicker } from "./item-picker";
import type { LineItem, InventoryItem } from "../types";

interface Props {
  lineItems: LineItem[];
  inventoryItems: InventoryItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<LineItem>) => void;
  onItemSelect: (lineId: string, item: InventoryItem | null) => void;
}

const COLUMNS = ["Catalog Item", "Description", "HSN/SAC", "Qty", "Unit Price", "Tax%", "Amount", ""];
const GRID = "150px 1fr 84px 64px 104px 54px 84px 34px";

export function LineItemsTable({
  lineItems, inventoryItems,
  onAdd, onRemove, onUpdate, onItemSelect,
}: Props) {
  return (
    <div style={{ marginBottom: 24 }}>
      {/* Headers */}
      <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, marginBottom: 6, paddingLeft: 4 }}>
        {COLUMNS.map((h, i) => (
          <span key={i} className="label" style={{ marginBottom: 0, fontSize: 10 }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lineItems.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center" }}
          >
            <ItemPicker
              items={inventoryItems}
              selectedId={item.itemId}
              onSelect={(inv) => onItemSelect(item.id, inv)}
            />

            <input
              className="input"
              placeholder="Description…"
              value={item.description}
              onChange={(e) => onUpdate(item.id, { description: e.target.value })}
            />

            <input
              className="input"
              placeholder="HSN/SAC"
              value={item.hsnSac ?? ""}
              onChange={(e) => onUpdate(item.id, { hsnSac: e.target.value })}
            />

            <input
              type="number" className="input"
              min={0.01} step={0.01}
              value={item.quantity}
              onChange={(e) => onUpdate(item.id, { quantity: parseFloat(e.target.value) || 0 })}
            />

            <input
              type="number" className="input"
              placeholder="0.00" min={0} step={0.01}
              value={item.unitPrice || ""}
              onChange={(e) => onUpdate(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
            />

            <input
              type="number" className="input"
              placeholder="0" min={0} max={100} step={0.5}
              value={item.taxPercent || ""}
              onChange={(e) => onUpdate(item.id, { taxPercent: parseFloat(e.target.value) || 0 })}
            />

            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textAlign: "right", padding: "9px 0" }}>
              {formatCurrency(item.quantity * item.unitPrice)}
            </div>

            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={lineItems.length === 1}
              style={{
                background: "none", border: "none",
                cursor: lineItems.length === 1 ? "not-allowed" : "pointer",
                color: lineItems.length === 1 ? "var(--text-muted)" : "#ef4444",
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: 8, padding: 0,
              }}
            >
              <Trash2 size={14} />
            </button>
          </motion.div>
        ))}
      </div>

      <button type="button" onClick={onAdd} className="btn-ghost" style={{ marginTop: 12, gap: 6, fontSize: 13 }}>
        <Plus size={14} /> Add line item
      </button>
    </div>
  );
}
