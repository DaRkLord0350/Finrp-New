"use client";

import { useEffect, useState } from "react";
import { X, History, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDateTime } from "@/lib/formatters/date";
import { getInvoiceStatusMeta } from "@/lib/invoice-status";

interface SnapshotItem {
  description: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  amount: number;
}

interface Snapshot {
  invoiceNumber?: string;
  status?: string;
  subtotal?: number;
  discount?: number;
  shipping?: number;
  taxAmount?: number;
  total?: number;
  notes?: string | null;
  terms?: string | null;
  items?: SnapshotItem[];
}

interface VersionRow {
  id: string;
  version: number;
  changeSummary: string | null;
  createdAt: string;
  snapshot: Snapshot;
}

export default function VersionHistoryModal({
  invoiceId,
  currency = "INR",
  onClose,
}: {
  invoiceId: string;
  currency?: string;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VersionRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/versions`);
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        if (!cancelled) {
          const rows = (data.versions ?? []) as VersionRow[];
          setVersions(rows);
          setSelected(rows[0] ?? null);
        }
      } catch {
        /* non-critical */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const money = (v: number | undefined) => formatCurrency(Number(v ?? 0), currency);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 16, width: "100%", maxWidth: 760, boxShadow: "var(--shadow-lg)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <History size={17} /> Version History
          </h2>
          <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <p style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading history…</p>
        ) : versions.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            No previous versions yet. Edits to this invoice will be snapshotted here.
          </p>
        ) : (
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            {/* List */}
            <div style={{ width: 240, borderRight: "1px solid var(--border)", overflowY: "auto", flexShrink: 0 }}>
              {versions.map((v) => {
                const active = selected?.id === v.id;
                const meta = getInvoiceStatusMeta(v.snapshot.status ?? "DRAFT");
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelected(v)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 16px",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      background: active ? "rgba(99,102,241,0.08)" : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Version {v.version}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{formatDateTime(v.createdAt)}</p>
                      <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                    </div>
                    {active && <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />}
                  </button>
                );
              })}
            </div>

            {/* Detail */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20, minWidth: 0 }}>
              {selected && (
                <>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                    {selected.changeSummary ?? "Snapshot"} · captured {formatDateTime(selected.createdAt)}
                  </p>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th style={th}>Item</th>
                        <th style={{ ...th, textAlign: "right" }}>Qty</th>
                        <th style={{ ...th, textAlign: "right" }}>Rate</th>
                        <th style={{ ...th, textAlign: "right" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.snapshot.items ?? []).map((it, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-primary)" }}>{it.description}</td>
                          <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-secondary)", textAlign: "right" }}>{it.quantity}</td>
                          <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-secondary)", textAlign: "right" }}>{money(it.unitPrice)}</td>
                          <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-primary)", textAlign: "right", fontWeight: 600 }}>{money(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 240, marginLeft: "auto" }}>
                    <Row label="Subtotal" value={money(selected.snapshot.subtotal)} />
                    {!!selected.snapshot.discount && <Row label="Discount" value={`- ${money(selected.snapshot.discount)}`} />}
                    {!!selected.snapshot.shipping && <Row label="Shipping" value={money(selected.snapshot.shipping)} />}
                    <Row label="Tax" value={money(selected.snapshot.taxAmount)} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginTop: 2 }}>
                      <span>Total</span>
                      <span>{money(selected.snapshot.total)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", color: "var(--text-muted)", fontSize: 11, fontWeight: 500 };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
