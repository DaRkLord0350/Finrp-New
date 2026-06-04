"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package, ChevronDown, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";
import type { InventoryItem } from "../types";

interface Props {
  items: InventoryItem[];
  selectedId?: string;
  onSelect: (item: InventoryItem | null) => void;
}

export function ItemPicker({ items, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = items.find((i) => i.id === selectedId);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = items.filter((i) => {
    const q = query.toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.sku?.toLowerCase() ?? "").includes(q);
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "6px 8px",
          background: selected ? "rgba(99,102,241,0.1)" : "var(--bg-elevated)",
          border: "1px solid", borderColor: selected ? "rgba(99,102,241,0.3)" : "var(--border)",
          borderRadius: 7, cursor: "pointer", fontSize: 11,
          color: selected ? "#818cf8" : "var(--text-muted)",
          whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        <Package size={12} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
          {selected ? selected.name : "From catalog"}
        </span>
        {selected ? (
          <X size={10} onClick={(e) => { e.stopPropagation(); onSelect(null); }} />
        ) : (
          <ChevronDown size={10} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, width: 260,
              background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
              borderRadius: 10, boxShadow: "var(--shadow-lg)", zIndex: 200, overflow: "hidden",
            }}
          >
            <div style={{ padding: "7px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 7 }}>
              <Search size={12} style={{ color: "var(--text-muted)" }} />
              <input
                autoFocus
                placeholder="Search items…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--text-primary)", width: "100%" }}
              />
            </div>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>No items found</div>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { onSelect(item); setOpen(false); setQuery(""); }}
                    style={{
                      display: "flex", flexDirection: "column", width: "100%", textAlign: "left",
                      padding: "8px 12px",
                      background: item.id === selectedId ? "rgba(99,102,241,0.08)" : "none",
                      border: "none", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.06)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = item.id === selectedId ? "rgba(99,102,241,0.08)" : "none"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{item.name}</span>
                      <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 600 }}>{formatCurrency(Number(item.sellingPrice))}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 2, fontSize: 10, color: "var(--text-muted)" }}>
                      {item.sku && <span>SKU: {item.sku}</span>}
                      <span style={{ color: item.stock > 0 ? "#16a34a" : "#ef4444" }}>Stock: {item.stock}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
