"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown } from "lucide-react";
import type { TdsTcsSection } from "../types";

interface Props {
  type: "TDS" | "TCS" | null;
  sections: TdsTcsSection[];
  sectionId: string;
  rate: number;
  onTypeChange: (type: "TDS" | "TCS" | null) => void;
  onSectionChange: (id: string) => void;
  onRateChange: (rate: number) => void;
}

const OPTIONS: Array<{ value: "TDS" | "TCS" | null; label: string }> = [
  { value: null, label: "None" },
  { value: "TDS", label: "TDS" },
  { value: "TCS", label: "TCS" },
];

export function TdsTcsControl({ type, sections, sectionId, rate, onTypeChange, onSectionChange, onRateChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const typeSections = sections.filter((s) => s.type === type);
  const selected = sections.find((s) => s.id === sectionId);
  const filtered = typeSections.filter((s) => {
    const q = query.toLowerCase();
    return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Radio: None / TDS / TCS */}
      <div role="radiogroup" aria-label="Withholding tax" style={{ display: "flex", gap: 6 }}>
        {OPTIONS.map((opt) => {
          const active = type === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onTypeChange(opt.value)}
              style={{
                flex: 1,
                padding: "6px 0",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 7,
                cursor: "pointer",
                background: active ? "rgba(99,102,241,0.14)" : "var(--bg-elevated)",
                color: active ? "#818cf8" : "var(--text-secondary)",
                border: `1px solid ${active ? "rgba(99,102,241,0.4)" : "var(--border)"}`,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Searchable section + rate */}
      {type && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 78px", gap: 8 }}>
          <div ref={ref} style={{ position: "relative" }}>
            <button
              type="button"
              className="input"
              onClick={() => setOpen((o) => !o)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", cursor: "pointer", width: "100%", fontSize: 12 }}
            >
              <span style={{ color: selected ? "var(--text-primary)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected ? `${selected.code} · ${selected.name}` : `Select ${type} section…`}
              </span>
              <ChevronDown size={13} style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: 6 }} />
            </button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0, background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 10, boxShadow: "var(--shadow-lg)", zIndex: 200, overflow: "hidden" }}
                >
                  <div style={{ padding: "7px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 7 }}>
                    <Search size={12} style={{ color: "var(--text-muted)" }} />
                    <input autoFocus placeholder={`Search ${type} sections…`} value={query} onChange={(e) => setQuery(e.target.value)} style={{ background: "none", border: "none", outline: "none", fontSize: 12, color: "var(--text-primary)", width: "100%" }} />
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {filtered.length === 0 ? (
                      <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>No sections</div>
                    ) : (
                      filtered.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { onSectionChange(s.id); setOpen(false); setQuery(""); }}
                          style={{ display: "flex", justifyContent: "space-between", gap: 8, width: "100%", textAlign: "left", padding: "8px 12px", background: s.id === sectionId ? "rgba(99,102,241,0.08)" : "none", border: "none", cursor: "pointer" }}
                        >
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{s.code}</span>
                            <span style={{ fontSize: 10.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{s.name}</span>
                          </span>
                          <span style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, flexShrink: 0 }}>{Number(s.rate)}%</span>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div style={{ position: "relative" }}>
            <input
              type="number"
              className="input"
              min={0}
              max={100}
              step={0.01}
              value={rate || ""}
              onChange={(e) => onRateChange(parseFloat(e.target.value) || 0)}
              style={{ textAlign: "right", paddingRight: 18, fontSize: 12 }}
              aria-label={`${type} rate`}
            />
            <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--text-muted)" }}>%</span>
          </div>
        </div>
      )}
    </div>
  );
}
