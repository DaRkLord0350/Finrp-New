"use client";

import { useEffect, useState } from "react";
import { BookOpen, Play } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, FYSelect, apiGet, apiPost, formatINR } from "../../_components/ui";

interface HeadLine { head: string; amount: number }
interface PL { payload: { income: HeadLine[]; expenses: HeadLine[]; totalIncome: number; totalExpenses: number; netProfit: number } }
interface BS { payload: { assets: HeadLine[]; liabilities: HeadLine[]; totalAssets: number; totalLiabilities: number; difference: number } }

export default function FinancialsPage() {
  const [fy, setFy] = useState("2025-26");
  const [pl, setPl] = useState<PL | null>(null);
  const [bs, setBs] = useState<BS | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await apiGet<{ profitAndLoss: PL | null; balanceSheet: BS | null }>(`/api/tax/financials?fy=${fy}`);
    setPl(r.profitAndLoss); setBs(r.balanceSheet);
  };
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [fy]);

  const generate = async () => {
    setBusy(true); setMsg(null);
    try { await apiPost("/api/tax/financials", { financialYear: fy }); await load(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };

  const Statement = ({ title, left, right, leftTotal, rightTotal, leftLabel, rightLabel }: { title: string; left: HeadLine[]; right: HeadLine[]; leftTotal: number; rightTotal: number; leftLabel: string; rightLabel: string }) => (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{leftLabel}</p>
          {left.map((l) => <div key={l.head} className="flex justify-between border-b border-border/40 py-1 text-sm"><span className="text-muted-foreground">{l.head}</span><span>{formatINR(l.amount)}</span></div>)}
          <div className="mt-1 flex justify-between text-sm font-bold"><span>Total</span><span>{formatINR(leftTotal)}</span></div>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{rightLabel}</p>
          {right.map((l) => <div key={l.head} className="flex justify-between border-b border-border/40 py-1 text-sm"><span className="text-muted-foreground">{l.head}</span><span>{formatINR(l.amount)}</span></div>)}
          <div className="mt-1 flex justify-between text-sm font-bold"><span>Total</span><span>{formatINR(rightTotal)}</span></div>
        </div>
      </div>
    </Section>
  );

  return (
    <div>
      <PageHeader
        title="Financial Statements"
        subtitle="Balance Sheet & Profit-and-Loss generated from the trial balance"
        icon={<BookOpen size={20} />}
        actions={<><FYSelect value={fy} onChange={setFy} /><Btn onClick={generate} disabled={busy}><Play size={14} />{busy ? "Generating…" : "Generate"}</Btn></>}
      />
      {msg && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-500">{msg}</div>}

      {!pl && !bs ? (
        <Section><p className="py-8 text-center text-sm text-muted-foreground">No statements yet. Import a trial balance, then click Generate.</p></Section>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Net profit" value={formatINR(pl?.payload.netProfit ?? 0)} tone={(pl?.payload.netProfit ?? 0) >= 0 ? "good" : "bad"} />
            <StatCard label="Total assets" value={formatINR(bs?.payload.totalAssets ?? 0)} />
            <StatCard label="BS difference" value={formatINR(bs?.payload.difference ?? 0)} tone={Math.abs(bs?.payload.difference ?? 0) < 1 ? "good" : "warn"} />
          </div>
          {pl && <Statement title="Profit & Loss" left={pl.payload.expenses} right={pl.payload.income} leftTotal={pl.payload.totalExpenses} rightTotal={pl.payload.totalIncome} leftLabel="Expenses" rightLabel="Income" />}
          {bs && <Statement title="Balance Sheet" left={bs.payload.assets} right={bs.payload.liabilities} leftTotal={bs.payload.totalAssets} rightTotal={bs.payload.totalLiabilities} leftLabel="Assets" rightLabel="Equity & Liabilities" />}
        </div>
      )}
    </div>
  );
}
