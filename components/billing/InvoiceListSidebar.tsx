"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, RefreshCw } from "lucide-react";
import { formatCompactCurrency } from "@/lib/formatters/currency";
import { getInvoiceStatusMeta } from "@/lib/invoice-status";

interface ListInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number | string;
  dueDate: string;
  customer?: { name: string | null } | null;
}

const FILTERS: Array<{ label: string; match: (s: string) => boolean }> = [
  { label: "All", match: () => true },
  { label: "Draft", match: (s) => s === "DRAFT" },
  { label: "Sent", match: (s) => s === "SENT" || s === "VIEWED" },
  { label: "Paid", match: (s) => s === "PAID" || s === "PARTIAL" },
  { label: "Overdue", match: (s) => s === "OVERDUE" },
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function dueLabel(due: string, status: string) {
  if (status === "PAID") return "Paid";
  const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return "";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
}

export default function InvoiceListSidebar({ currentId }: { currentId: string }) {
  const [invoices, setInvoices] = useState<ListInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/invoices?take=100");
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (!cancelled) setInvoices((data.invoices ?? []) as ListInvoice[]);
      } catch {
        /* sidebar is non-critical */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFilter = FILTERS.find((f) => f.label === filter) ?? FILTERS[0];
  const filtered = useMemo(
    () =>
      invoices.filter((inv) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          (inv.customer?.name ?? "").toLowerCase().includes(q);
        return matchesSearch && activeFilter.match(inv.status);
      }),
    [invoices, search, activeFilter]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          className="input"
          style={{ paddingLeft: 34, fontSize: 13 }}
          placeholder="Search invoices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.label)}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              background: filter === f.label ? "rgba(99,102,241,0.15)" : "transparent",
              borderColor: filter === f.label ? "rgba(99,102,241,0.4)" : "var(--border)",
              color: filter === f.label ? "#818cf8" : "var(--text-secondary)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24, color: "var(--text-muted)", gap: 8, fontSize: 13 }}>
            <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>No invoices found</p>
        ) : (
          filtered.map((inv) => {
            const meta = getInvoiceStatusMeta(inv.status);
            const active = inv.id === currentId;
            return (
              <Link
                key={inv.id}
                href={`/billing/${inv.id}`}
                style={{
                  display: "block",
                  padding: 12,
                  borderRadius: 10,
                  textDecoration: "none",
                  border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                  background: active ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${meta.color}22`, border: `1px solid ${meta.color}44`, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {initials(inv.customer?.name ?? "—")}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inv.customer?.name ?? "—"}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{inv.invoiceNumber}</p>
                  </div>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{formatCompactCurrency(Number(inv.total))}</span>
                  <span style={{ fontSize: 10, color: inv.status === "OVERDUE" ? "#ef4444" : "var(--text-muted)" }}>{dueLabel(inv.dueDate, inv.status)}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
