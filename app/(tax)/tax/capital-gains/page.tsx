"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Plus, Upload } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, Field, TextInput, NumInput, Select, FYSelect, StatusBadge, apiGet, apiPost, formatINR } from "../../_components/ui";

interface Txn { id: string; assetType: string; description?: string | null; term: string; saleDate: string; purchaseValue: string; saleValue: string; gain: string; taxAmount: string }
interface Summary { equityLtcgGain: number; equityLtcgExemption: number; equityLtcgTax: number; equityStcgGain: number; equityStcgTax: number; otherLtcgGain: number; otherLtcgTax: number; totalTax: number; totalGain: number }

const ASSETS = ["EQUITY_STT", "MUTUAL_FUND_EQUITY", "MUTUAL_FUND_DEBT", "PROPERTY", "GOLD", "UNLISTED_SHARES", "OTHER"];

export default function CapitalGainsPage() {
  const [fy, setFy] = useState("2025-26");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const [assetType, setAssetType] = useState("EQUITY_STT");
  const [desc, setDesc] = useState(""); const [pDate, setPDate] = useState("2023-01-10"); const [sDate, setSDate] = useState("2025-05-10");
  const [pVal, setPVal] = useState(100000); const [sVal, setSVal] = useState(180000); const [exp, setExp] = useState(0);

  const load = async () => {
    const r = await apiGet<{ txns: Txn[]; summary: Summary }>(`/api/tax/capital-gains?fy=${fy}`);
    setTxns(r.txns); setSummary(r.summary);
  };
  useEffect(() => {
    let active = true;
    void (async () => { try { await load(); } catch (e) { if (active) setMsg((e as Error).message); } })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy]);

  const add = async () => {
    try { const r = await apiPost<{ term: string; gain: string; taxAmount: string }>("/api/tax/capital-gains", { assetType, description: desc || undefined, purchaseDate: pDate, saleDate: sDate, purchaseValue: pVal, saleValue: sVal, expenses: exp }); setMsg(`${r.term}: gain ${formatINR(r.gain)}, tax ${formatINR(r.taxAmount)}`); await load(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const doImport = async () => {
    try { const r = await apiPost<{ created: number }>("/api/tax/capital-gains/import", { format: "csv", content: csv }); setMsg(`Imported ${r.created} transactions.`); setCsv(""); setShowImport(false); await load(); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div>
      <PageHeader
        title="Capital Gains"
        subtitle="Equity / MF / property · STCG-LTCG · CII indexation · §112A exemption"
        icon={<TrendingUp size={20} />}
        actions={<><FYSelect value={fy} onChange={setFy} /><Btn variant="ghost" onClick={() => setShowImport((v) => !v)}><Upload size={14} />Broker CSV</Btn></>}
      />
      {msg && <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{msg}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total gain" value={formatINR(summary?.totalGain ?? 0)} />
        <StatCard label="Equity LTCG (112A)" value={formatINR(summary?.equityLtcgGain ?? 0)} hint={`Exempt ${formatINR(summary?.equityLtcgExemption ?? 0)}`} />
        <StatCard label="Other LTCG" value={formatINR(summary?.otherLtcgGain ?? 0)} />
        <StatCard label="Total tax" value={formatINR(summary?.totalTax ?? 0)} tone="warn" />
      </div>

      {showImport && (
        <Section title="Import broker statement (CSV)">
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} placeholder="asset_type,description,purchase_date,sale_date,purchase_value,sale_value,expenses" className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs" />
          <div className="mt-2"><Btn onClick={doImport} disabled={!csv.trim()}>Import</Btn></div>
        </Section>
      )}

      <Section title="Add transaction">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Asset"><Select value={assetType} onChange={setAssetType} options={ASSETS.map((a) => ({ value: a, label: a.replace(/_/g, " ") }))} /></Field>
          <Field label="Description"><TextInput value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <Field label="Purchase date"><TextInput type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} /></Field>
          <Field label="Sale date"><TextInput type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} /></Field>
          <Field label="Purchase value"><NumInput value={pVal} onChange={setPVal} /></Field>
          <Field label="Sale value"><NumInput value={sVal} onChange={setSVal} /></Field>
          <Field label="Expenses"><NumInput value={exp} onChange={setExp} /></Field>
        </div>
        <div className="mt-2"><Btn onClick={add}><Plus size={14} />Add &amp; compute</Btn></div>
      </Section>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Asset</th><th className="px-3 py-2">Sale date</th><th className="px-3 py-2">Term</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2 text-right">Sale</th><th className="px-3 py-2 text-right">Gain</th><th className="px-3 py-2 text-right">Tax</th></tr>
          </thead>
          <tbody>
            {txns.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No transactions for {fy}.</td></tr>
            ) : txns.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-2">{t.assetType.replace(/_/g, " ")}<br /><span className="text-[11px] text-muted-foreground">{t.description}</span></td>
                <td className="px-3 py-2 text-muted-foreground">{new Date(t.saleDate).toLocaleDateString("en-IN")}</td>
                <td className="px-3 py-2"><StatusBadge status={t.term} /></td>
                <td className="px-3 py-2 text-right">{formatINR(t.purchaseValue)}</td>
                <td className="px-3 py-2 text-right">{formatINR(t.saleValue)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatINR(t.gain)}</td>
                <td className="px-3 py-2 text-right">{formatINR(t.taxAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
