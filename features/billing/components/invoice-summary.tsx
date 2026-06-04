"use client";

import { Loader2, Send, Save } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";
import type { LineItem } from "../types";

interface Props {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: number;
  lineItems: LineItem[];
  saving: boolean;
  dataLoading: boolean;
  onSubmit: (status: "DRAFT" | "SENT") => void;
}

export function InvoiceSummary({
  subtotal, taxAmount, total, taxRate,
  lineItems, saving, dataLoading, onSubmit,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Totals */}
      <div className="surface" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--text-primary)" }}>
          Invoice Summary
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Subtotal", value: formatCurrency(subtotal) },
            { label: `Tax (${taxRate}%)`, value: formatCurrency(taxAmount) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
            </div>
          ))}
          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#818cf8" }}>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="surface" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          className="btn-brand"
          style={{ width: "100%", justifyContent: "center", padding: "11px" }}
          onClick={() => onSubmit("SENT")}
          disabled={saving || dataLoading}
        >
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Send size={15} /> Send Invoice</>}
        </button>
        <button
          className="btn-ghost"
          style={{ width: "100%", justifyContent: "center", padding: "11px" }}
          onClick={() => onSubmit("DRAFT")}
          disabled={saving || dataLoading}
        >
          <Save size={15} /> Save as Draft
        </button>
      </div>

      {/* Line items breakdown */}
      {lineItems.some((i) => i.description && i.unitPrice > 0) && (
        <div className="surface" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Line Items
          </p>
          {lineItems.filter((i) => i.description).map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1, marginRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.description} × {item.quantity}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", flexShrink: 0 }}>
                {formatCurrency(item.quantity * item.unitPrice)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
