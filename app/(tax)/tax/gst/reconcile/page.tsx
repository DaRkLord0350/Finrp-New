"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows, Upload, Play, Sparkles } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, PeriodSelect, StatusBadge, apiGet, apiPost, formatINR } from "../../../_components/ui";

interface Mismatch {
  id: string; outcome: string; kind?: string | null;
  invoiceNumber?: string | null; supplierGstin?: string | null;
  bookTaxable?: string | null; bookTax?: string | null;
  gstr2bTaxable?: string | null; gstr2bTax?: string | null;
  difference?: string | null; aiExplanation?: string | null;
}
interface Recon {
  matchedCount: number; partialCount: number; mismatchCount: number;
  missingIn2bCount: number; missingInBooksCount: number;
  itcInBooks: string; itcIn2b: string; itcDifference: string;
  mismatches: Mismatch[];
}

export default function ReconcilePage() {
  const [period, setPeriod] = useState("052025");
  const [recon, setRecon] = useState<Recon | null>(null);
  const [csv, setCsv] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [explaining, setExplaining] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async (p: string) => {
    const r = await apiGet<{ reconciliation: Recon | null }>(`/api/tax/gst/reconcile?period=${p}`);
    setRecon(r.reconciliation);
  };
  useEffect(() => { load(period).catch((e) => setMsg(e.message)); }, [period]);

  const importFetch = async () => {
    setBusy("fetch"); setMsg(null);
    try { const r = await apiPost<{ count: number }>("/api/tax/gst/gstr2b", { period, format: "fetch" }); setMsg(`Fetched ${r.count} 2B records from provider.`); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  };
  const importCsv = async () => {
    setBusy("csv"); setMsg(null);
    try { const r = await apiPost<{ count: number }>("/api/tax/gst/gstr2b", { period, format: "csv", content: csv }); setMsg(`Imported ${r.count} 2B records.`); setCsv(""); setShowImport(false); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  };
  const reconcile = async () => {
    setBusy("recon"); setMsg(null);
    try { await apiPost("/api/tax/gst/reconcile", { period }); await load(period); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  };
  const explain = async (id: string) => {
    setExplaining(id);
    try {
      const r = await apiPost<{ explanation: string }>(`/api/tax/gst/mismatches/${id}/explain`);
      setRecon((prev) => prev ? { ...prev, mismatches: prev.mismatches.map((m) => m.id === id ? { ...m, aiExplanation: r.explanation } : m) } : prev);
    } catch (e) { setMsg((e as Error).message); }
    finally { setExplaining(null); }
  };

  return (
    <div>
      <PageHeader
        title="GSTR-2B Reconciliation"
        subtitle="Match purchase invoices in your books against the auto-drafted GSTR-2B"
        icon={<GitCompareArrows size={20} />}
        actions={
          <>
            <PeriodSelect value={period} onChange={setPeriod} />
            <Btn variant="ghost" onClick={() => setShowImport((v) => !v)}><Upload size={14} />Import 2B</Btn>
            <Btn variant="ghost" onClick={importFetch} disabled={busy === "fetch"}>Fetch from GSP</Btn>
            <Btn onClick={reconcile} disabled={busy === "recon"}><Play size={14} />{busy === "recon" ? "…" : "Reconcile"}</Btn>
          </>
        }
      />
      {msg && <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{msg}</div>}

      {showImport && (
        <Section title="Import GSTR-2B (CSV)">
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} placeholder="supplier_gstin,invoice_number,taxable_value,igst,cgst,sgst" className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs" />
          <div className="mt-2"><Btn onClick={importCsv} disabled={busy === "csv" || !csv.trim()}>{busy === "csv" ? "Importing…" : "Import"}</Btn></div>
        </Section>
      )}

      <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Matched" value={recon?.matchedCount ?? 0} tone="good" />
        <StatCard label="Mismatches" value={(recon?.mismatchCount ?? 0) + (recon?.partialCount ?? 0)} tone="bad" />
        <StatCard label="Missing in 2B" value={recon?.missingIn2bCount ?? 0} tone="warn" />
        <StatCard label="Missing in books" value={recon?.missingInBooksCount ?? 0} tone="warn" />
        <StatCard label="ITC difference" value={formatINR(recon?.itcDifference ?? 0)} tone={recon && Number(recon.itcDifference) > 0 ? "bad" : "good"} />
      </div>

      <Section title="Mismatch detail">
        {!recon || recon.mismatches.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No reconciliation yet. Import 2B (or load demo data) then click Reconcile.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recon.mismatches.filter((m) => m.outcome !== "MATCHED").map((m) => (
              <div key={m.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <StatusBadge status={m.outcome} />
                    <span className="font-medium">{m.invoiceNumber ?? "—"}</span>
                    <span className="text-muted-foreground">{m.supplierGstin ?? ""}</span>
                  </div>
                  <Btn variant="ghost" onClick={() => explain(m.id)} disabled={explaining === m.id}>
                    <Sparkles size={13} />{explaining === m.id ? "…" : "Explain"}
                  </Btn>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
                  <span>Books taxable: <b className="text-foreground">{formatINR(m.bookTaxable ?? 0)}</b></span>
                  <span>Books tax: <b className="text-foreground">{formatINR(m.bookTax ?? 0)}</b></span>
                  <span>2B taxable: <b className="text-foreground">{formatINR(m.gstr2bTaxable ?? 0)}</b></span>
                  <span>Diff: <b className="text-red-500">{formatINR(m.difference ?? 0)}</b></span>
                </div>
                {m.aiExplanation && <p className="mt-2 rounded-md bg-primary/5 p-2 text-xs text-foreground">{m.aiExplanation}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
