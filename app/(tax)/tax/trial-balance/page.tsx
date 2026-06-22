"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale, Upload } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, FYSelect, StatusBadge, apiGet, apiPost, formatINR } from "../../_components/ui";

interface Line { id: string; ledgerName: string; debit: string; credit: string; group?: string | null; head?: string | null; statement: string }
interface TB { id: string; financialYear: string; totalDebit: string; totalCredit: string; balanced: boolean; lineCount: number; lines: Line[] }

export default function TrialBalancePage() {
  const [fy, setFy] = useState("2025-26");
  const [tb, setTb] = useState<TB | null>(null);
  const [csv, setCsv] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await apiGet<{ trialBalance: TB | null }>(`/api/tax/trial-balance?fy=${fy}`);
    setTb(r.trialBalance);
  };
  useEffect(() => {
    let active = true;
    void (async () => { try { await load(); } catch (e) { if (active) setMsg((e as Error).message); } })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy]);

  const doImport = async () => {
    try { const r = await apiPost<{ lineCount: number; balanced: boolean }>("/api/tax/trial-balance", { financialYear: fy, format: "csv", content: csv }); setMsg(`Imported ${r.lineCount} lines — ${r.balanced ? "balanced ✓" : "UNBALANCED"}.`); setCsv(""); setShowImport(false); await load(); }
    catch (e) { setMsg((e as Error).message); }
  };

  const sample = "ledger,debit,credit\nSales,0,500000\nPurchases,300000,0\nSalary,80000,0\nCash,40000,0\nSundry Debtors,120000,0\nCapital,0,40000\nSundry Creditors,0,0";

  return (
    <div>
      <PageHeader
        title="Trial Balance"
        subtitle="Import · intelligent ledger mapping · balance check"
        icon={<Scale size={20} />}
        actions={<><FYSelect value={fy} onChange={setFy} /><Btn variant="ghost" onClick={() => setShowImport((v) => !v)}><Upload size={14} />Import CSV</Btn><Link href="/tax/financials" className="text-sm text-primary hover:underline">Financials →</Link></>}
      />
      {msg && <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{msg}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Lines" value={tb?.lineCount ?? 0} />
        <StatCard label="Total debit" value={formatINR(tb?.totalDebit ?? 0)} />
        <StatCard label="Total credit" value={formatINR(tb?.totalCredit ?? 0)} />
        <StatCard label="Status" value={tb ? (tb.balanced ? "Balanced" : "Unbalanced") : "—"} tone={tb?.balanced ? "good" : "bad"} />
      </div>

      {showImport && (
        <Section title="Import trial balance (CSV)">
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={6} placeholder={sample} className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs" />
          <div className="mt-2"><Btn onClick={doImport} disabled={!csv.trim()}>Import &amp; auto-map</Btn></div>
        </Section>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Ledger</th><th className="px-3 py-2">Mapped head</th><th className="px-3 py-2">Statement</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th></tr>
          </thead>
          <tbody>
            {!tb || tb.lines.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No trial balance for {fy}. Import a CSV.</td></tr>
            ) : tb.lines.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{l.ledgerName}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.head ?? "—"} <span className="text-[11px]">{l.group}</span></td>
                <td className="px-3 py-2"><StatusBadge status={l.statement} /></td>
                <td className="px-3 py-2 text-right">{Number(l.debit) ? formatINR(l.debit) : ""}</td>
                <td className="px-3 py-2 text-right">{Number(l.credit) ? formatINR(l.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
