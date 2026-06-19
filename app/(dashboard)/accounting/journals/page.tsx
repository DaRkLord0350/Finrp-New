"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, RefreshCw, BookText } from "lucide-react";
import { SearchBar } from "@/components/ui/SearchBar";
import { Filters, type FilterField } from "@/components/ui/Filters";
import { Pagination } from "@/components/ui/Pagination";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { formatCurrency } from "@/lib/formatters/currency";
import {
  useJournals,
  type JournalListFilters,
  type JournalStatus,
  type JournalType,
} from "@/hooks/useJournals";

const STATUS_COLORS: Record<JournalStatus, string> = {
  DRAFT: "#f59e0b",
  POSTED: "#10b981",
  VOID: "#ef4444",
};

export default function JournalsPage() {
  const router = useRouter();
  const { isMobile } = useBreakpoint();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<JournalStatus | "">("");
  const [journalType, setJournalType] = useState<JournalType | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filters: JournalListFilters = useMemo(
    () => ({
      q: q || undefined,
      status: status || undefined,
      journalType: journalType || undefined,
      page,
      pageSize,
    }),
    [q, status, journalType, page, pageSize]
  );

  const { journals, total, loading, refetch } = useJournals(filters);

  const filterFields: FilterField[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      value: status || "all",
      options: [
        { label: "All", value: "all" },
        { label: "Draft", value: "DRAFT" },
        { label: "Posted", value: "POSTED" },
        { label: "Void", value: "VOID" },
      ],
      onChange: (v) => { setStatus(v === "all" ? "" : (v as JournalStatus)); setPage(1); },
    },
    {
      key: "type",
      label: "Type",
      type: "select",
      value: journalType || "all",
      options: [
        { label: "All", value: "all" },
        { label: "Manual", value: "MANUAL" },
        { label: "System", value: "SYSTEM" },
        { label: "Opening", value: "OPENING" },
        { label: "Closing", value: "CLOSING" },
        { label: "Forex", value: "FOREX" },
        { label: "Adjustment", value: "ADJUSTMENT" },
      ],
      onChange: (v) => { setJournalType(v === "all" ? "" : (v as JournalType)); setPage(1); },
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", marginBottom: 28, gap: 14 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Manual Journals</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            Record and post double-entry journal entries to the general ledger.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refetch} className="btn-ghost" style={{ padding: "8px 12px" }} title="Refresh">
            <RefreshCw size={15} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
          <Link href="/accounting/journals/new" className="btn-brand" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> {isMobile ? "New" : "New Journal"}
          </Link>
        </div>
      </div>

      <motion.div className="surface" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: 12, padding: isMobile ? "16px" : "16px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookText size={16} color="var(--brand-400)" />
            </div>
            <div>
              <h3 className="section-title" style={{ fontSize: 15 }}>Journal Entries</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{total} entr{total !== 1 ? "ies" : "y"}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SearchBar placeholder="Search number, reference, description…" value={q} onChange={(v) => { setQ(v); setPage(1); }} />
            <Filters fields={filterFields} onClear={() => { setStatus(""); setJournalType(""); setQ(""); setPage(1); }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={th}>Number</th>
                <th style={th}>Date</th>
                <th style={th}>Reference</th>
                <th style={th}>Description</th>
                <th style={{ ...th, textAlign: "right" }}>Amount</th>
                <th style={th}>Type</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Loading…</td></tr>
              )}
              {!loading && journals.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                  No journals yet. <Link href="/accounting/journals/new" style={{ color: "var(--brand-400)" }}>Create your first entry →</Link>
                </td></tr>
              )}
              {!loading && journals.map((j) => (
                <tr key={j.id} onClick={() => router.push(`/accounting/journals/${j.id}`)} style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }} className="row-hover">
                  <td style={td}><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{j.journalNumber ?? "—"}</span></td>
                  <td style={td}>{new Date(j.entryDate).toLocaleDateString("en-IN")}</td>
                  <td style={{ ...td, color: "var(--text-muted)" }}>{j.reference ?? "—"}</td>
                  <td style={{ ...td, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.description ?? "—"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{formatCurrency(Number(j.totalDebit))}</td>
                  <td style={td}><span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{j.journalType}</span></td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[j.status], background: `${STATUS_COLORS[j.status]}1a`, padding: "2px 8px", borderRadius: 6 }}>{j.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 && (
          <div style={{ padding: isMobile ? "12px 16px" : "14px 24px", borderTop: "1px solid var(--border)" }}>
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          </div>
        )}
      </motion.div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .row-hover:hover { background: var(--bg-elevated); }
      `}</style>
    </div>
  );
}

const th: React.CSSProperties = { padding: "12px 24px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "12px 24px", color: "var(--text-secondary)" };
