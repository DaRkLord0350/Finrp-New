"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown } from "lucide-react";
import Link from "next/link";
import type { Customer } from "../types";

interface Props {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  loading: boolean;
}

export function CustomerCombobox({ customers, value, onChange, loading }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = customers.find((c) => c.id === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = customers.filter((c) => {
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company?.toLowerCase() ?? "").includes(q) ||
      (c.email?.toLowerCase() ?? "").includes(q)
    );
  });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", cursor: "pointer", width: "100%" }}
        disabled={loading}
      >
        {loading ? (
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading customers…</span>
        ) : selected ? (
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
            {selected.name}{selected.company ? ` · ${selected.company}` : ""}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Select customer…</span>
        )}
        <ChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0, marginLeft: 8 }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "var(--bg-surface)", border: "1px solid var(--border-strong)",
              borderRadius: 10, boxShadow: "var(--shadow-lg)", zIndex: 200, overflow: "hidden",
            }}
          >
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <Search size={13} style={{ color: "var(--text-muted)" }} />
              <input
                autoFocus
                placeholder="Search customers…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)", width: "100%" }}
              />
            </div>

            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                  No customers found
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onChange(c.id); setOpen(false); setQuery(""); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "9px 14px",
                      background: c.id === value ? "rgba(99,102,241,0.08)" : "none",
                      border: "none", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.06)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = c.id === value ? "rgba(99,102,241,0.08)" : "none"; }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{c.name}</div>
                    {(c.company || c.email) && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                        {[c.company, c.email].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)" }}>
              <Link href="/crm" style={{ fontSize: 12, color: "#818cf8", textDecoration: "none" }}>
                + Manage customers →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
