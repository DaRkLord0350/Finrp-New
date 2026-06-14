"use client";

import { useState } from "react";
import { ReceiptText, FileCheck2, Send, ScanLine, Truck, GitCompareArrows, ArrowRight, Layers } from "lucide-react";
import { gstReturnTiles, gstFilingQueue, itcReconSummary, formatINR } from "@/lib/ca-hub/demo-data";
import { Kpi, Panel, FilingPill, PrimaryButton, GhostButton, MiniProgress } from "@/components/ca-hub/ui";

export default function GstCommandCenter() {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  const allSel = selected.size === gstFilingQueue.length;
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(gstFilingQueue.map((_, i) => i)));

  const totalLiability = gstFilingQueue.reduce((s, r) => s + r.liability, 0);
  const totalItc = gstFilingQueue.reduce((s, r) => s + r.itc, 0);
  const itcTotal = itcReconSummary.matched + itcReconSummary.partial + itcReconSummary.mismatch + itcReconSummary.missingIn2B + itcReconSummary.missingInBooks;
  const matchPct = Math.round((itcReconSummary.matched / itcTotal) * 100);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "rgba(245,158,11,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ReceiptText size={21} color="#f59e0b" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>GST Command Center</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>GSTR-1 · 3B · 9 · 9C · e-invoice · e-way bill · ITC reconciliation</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <GhostButton icon={ScanLine}>E-Invoice</GhostButton>
          <GhostButton icon={Truck}>E-Way Bill</GhostButton>
          <PrimaryButton icon={Layers}>Bulk File</PrimaryButton>
        </div>
      </div>

      {/* Return tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {gstReturnTiles.map((t) => (
          <div key={t.code} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: t.accent }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{t.code}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: t.accent, background: `${t.accent}1a`, padding: "2px 8px", borderRadius: 999 }}>Due {t.due}</span>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12 }}>{t.label}</p>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: "#10b981", fontWeight: 600 }}>{t.filed} filed</span>
              <span style={{ color: "#f59e0b", fontWeight: 600 }}>{t.pending} pending</span>
            </div>
            <MiniProgress value={(t.filed / (t.filed + t.pending)) * 100} color={t.accent} />
          </div>
        ))}
      </div>

      {/* Liability summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Kpi label="Net Tax Liability" value={formatINR(totalLiability)} icon={ReceiptText} accent="#f59e0b" sub="this period (queue)" />
        <Kpi label="ITC Available" value={formatINR(totalItc)} icon={FileCheck2} accent="#10b981" />
        <Kpi label="ITC Match Rate" value={`${matchPct}%`} icon={GitCompareArrows} accent="#6366f1" sub={`${itcReconSummary.matched}/${itcTotal} invoices`} />
        <Kpi label="Mismatches" value={itcReconSummary.mismatch + itcReconSummary.missingIn2B} icon={Send} accent="#ef4444" sub="need action" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        {/* Filing queue */}
        <Panel
          title="Bulk Filing Queue"
          subtitle={selected.size > 0 ? `${selected.size} selected` : "Select returns to file in one workflow"}
          action={selected.size > 0 ? <PrimaryButton icon={Send}>File {selected.size} returns</PrimaryButton> : undefined}
        >
          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" checked={allSel} onChange={toggleAll} style={{ cursor: "pointer" }} /></th>
                  <th>Client / GSTIN</th><th>Return</th><th>Period</th>
                  <th style={{ textAlign: "right" }}>Liability</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {gstFilingQueue.map((r, i) => (
                  <tr key={i} style={{ background: selected.has(i) ? "var(--bg-hover)" : undefined }}>
                    <td><input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} style={{ cursor: "pointer" }} /></td>
                    <td>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{r.client}</p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "monospace" }}>{r.gstin}</p>
                    </td>
                    <td><span style={{ fontSize: 11.5, fontWeight: 700, color: "#f59e0b" }}>{r.return}</span></td>
                    <td><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.period}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>{formatINR(r.liability)}</td>
                    <td><FilingPill state={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* ITC reconciliation */}
        <Panel title="ITC Reconciliation" subtitle="GSTR-2B vs purchase register">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Fully matched", value: itcReconSummary.matched, color: "#10b981" },
              { label: "Partial match", value: itcReconSummary.partial, color: "#06b6d4" },
              { label: "Value mismatch", value: itcReconSummary.mismatch, color: "#f59e0b" },
              { label: "Missing in 2B", value: itcReconSummary.missingIn2B, color: "#ef4444" },
              { label: "Missing in books", value: itcReconSummary.missingInBooks, color: "#8b5cf6" },
            ].map((r) => (
              <div key={r.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{r.value}</span>
                </div>
                <MiniProgress value={(r.value / itcTotal) * 100} color={r.color} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "11px 13px", borderRadius: 10, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--text-primary)" }}>{itcReconSummary.mismatch + itcReconSummary.missingIn2B} invoices</b> require follow-up with suppliers before claiming ITC.
            </p>
            <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#6366f1", textDecoration: "none", marginTop: 6 }}>
              Open reconciliation <ArrowRight size={12} />
            </a>
          </div>
        </Panel>
      </div>
    </div>
  );
}
