"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, X, Check, Package } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";
import type { InventoryItem } from "../types";

interface Props {
  items: InventoryItem[];
  currency: string;
  onClose: () => void;
  onConfirm: (selected: InventoryItem[]) => void;
}

export function BulkAddModal({ items, currency, onClose, onConfirm }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = items.filter((i) => {
    const q = query.toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.sku?.toLowerCase() ?? "").includes(q);
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bulk add items"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="surface"
        style={{ width: "100%", maxWidth: 520, maxHeight: "80vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Add items from catalog</h3>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input autoFocus placeholder="Search items…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)", width: "100%" }} />
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              <Package size={20} style={{ opacity: 0.5, marginBottom: 6 }} />
              <p>No catalog items found.</p>
            </div>
          ) : (
            filtered.map((it) => {
              const checked = selected.has(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggle(it.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 20px", background: checked ? "rgba(99,102,241,0.08)" : "none", border: "none", cursor: "pointer" }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${checked ? "#818cf8" : "var(--border-strong)"}`, background: checked ? "#6366f1" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {checked && <Check size={12} color="#fff" />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{it.name}</span>
                    {it.sku && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>SKU: {it.sku}</span>}
                  </span>
                  <span style={{ fontSize: 12, color: "#818cf8", fontWeight: 600 }}>{formatCurrency(Number(it.sellingPrice), currency)}</span>
                </button>
              );
            })
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{selected.size} selected</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} className="btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
            <button
              className="btn-brand"
              disabled={selected.size === 0}
              onClick={() => onConfirm(items.filter((i) => selected.has(i.id)))}
              style={{ fontSize: 13 }}
            >
              Add {selected.size > 0 ? selected.size : ""} item{selected.size === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
