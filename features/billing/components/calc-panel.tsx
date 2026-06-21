"use client";

import { Loader2, Send, Save } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/currency";
import { TdsTcsControl } from "./tds-tcs-control";
import type { InvoiceFormApi } from "../hooks/use-invoice-form";

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{children}</div>
    </div>
  );
}

const valStyle: React.CSSProperties = { fontSize: 13, color: "var(--text-primary)", fontWeight: 500, minWidth: 80, textAlign: "right" };

export function CalcPanel({ form }: { form: InvoiceFormApi }) {
  const t = form.totals;
  const cur = form.currency;
  const money = (v: number) => formatCurrency(v, cur);
  const miniInput: React.CSSProperties = { width: 96, textAlign: "right", fontSize: 12, padding: "6px 8px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="surface" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "var(--text-primary)" }}>Calculation</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Row label="Subtotal"><span style={valStyle}>{money(t.subtotal)}</span></Row>

          {t.lineDiscountTotal > 0 && (
            <Row label="Line discounts"><span style={{ ...valStyle, color: "#f59e0b" }}>− {money(t.lineDiscountTotal)}</span></Row>
          )}

          {/* Invoice-level discount */}
          <Row
            label={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Discount
                <span style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                  {(["PERCENT", "FIXED"] as const).map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => form.setDiscountType(dt)}
                      style={{ padding: "2px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: form.discountType === dt ? "rgba(99,102,241,0.16)" : "transparent", color: form.discountType === dt ? "#818cf8" : "var(--text-muted)" }}
                    >
                      {dt === "PERCENT" ? "%" : cur === "INR" ? "₹" : "Amt"}
                    </button>
                  ))}
                </span>
              </span>
            }
          >
            <input
              type="number"
              className="input"
              min={0}
              step={form.discountType === "PERCENT" ? 0.5 : 0.01}
              value={form.discountValue || ""}
              placeholder="0"
              onChange={(e) => form.setDiscountValue(parseFloat(e.target.value) || 0)}
              style={miniInput}
            />
          </Row>
          {t.invoiceDiscount > 0 && (
            <Row label={<span style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 8 }}>Discount applied</span>}>
              <span style={{ ...valStyle, color: "#f59e0b" }}>− {money(t.invoiceDiscount)}</span>
            </Row>
          )}

          {/* Shipping */}
          <Row label="Shipping">
            <input type="number" className="input" min={0} step={0.01} value={form.shipping || ""} placeholder="0" onChange={(e) => form.setShipping(parseFloat(e.target.value) || 0)} style={miniInput} />
          </Row>

          {/* Adjustment (+/-) */}
          <Row label="Adjustment (+/−)">
            <input type="number" className="input" step={0.01} value={form.adjustment || ""} placeholder="0" onChange={(e) => form.setAdjustment(parseFloat(e.target.value) || 0)} style={miniInput} />
          </Row>

          {/* GST / VAT */}
          <Row label="GST / VAT"><span style={valStyle}>{money(t.taxAmount)}</span></Row>

          <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />

          {/* TDS / TCS */}
          <div>
            <span className="label" style={{ marginBottom: 8, display: "block" }}>Withholding Tax (TDS / TCS)</span>
            <TdsTcsControl
              type={form.tdsTcsType}
              sections={form.sections}
              sectionId={form.tdsTcsSectionId}
              rate={form.tdsTcsRate}
              onTypeChange={form.selectTdsTcsType}
              onSectionChange={form.selectTdsTcsSection}
              onRateChange={form.setTdsTcsRate}
            />
            {form.tdsTcsType && t.tdsTcsAmount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{form.tdsTcsType} {form.tdsTcsType === "TDS" ? "deducted" : "collected"}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: form.tdsTcsType === "TDS" ? "#f59e0b" : "#10b981" }}>
                  {form.tdsTcsType === "TDS" ? "− " : "+ "}{money(t.tdsTcsAmount)}
                </span>
              </div>
            )}
          </div>

          <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />

          {/* Round-off */}
          <Row
            label={
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                <input type="checkbox" checked={form.roundOffEnabled} onChange={(e) => form.setRoundOffEnabled(e.target.checked)} style={{ accentColor: "#6366f1" }} />
                Round off
              </label>
            }
          >
            <span style={{ ...valStyle, color: "var(--text-muted)" }}>{t.roundOff === 0 ? "—" : `${t.roundOff > 0 ? "+ " : "− "}${money(Math.abs(t.roundOff))}`}</span>
          </Row>

          <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />

          {/* Grand total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Grand Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#818cf8" }}>{money(t.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="surface" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn-brand" style={{ width: "100%", justifyContent: "center", padding: 11 }} onClick={() => form.handleSubmit("SENT")} disabled={form.saving || form.dataLoading}>
          {form.saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Send size={15} /> Save &amp; Send</>}
        </button>
        <button className="btn-ghost" style={{ width: "100%", justifyContent: "center", padding: 11 }} onClick={() => form.handleSubmit("DRAFT")} disabled={form.saving || form.dataLoading}>
          <Save size={15} /> Save as Draft
        </button>
      </div>
    </div>
  );
}
