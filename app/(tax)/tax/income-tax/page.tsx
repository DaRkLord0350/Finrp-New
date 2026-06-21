"use client";

import { useState } from "react";
import { Coins, Calculator } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, Field, NumInput, Select, apiPost, formatINR } from "../../_components/ui";

interface RegimeResult { regime: string; grossTotalIncome: number; totalDeductions: number; taxableIncome: number; taxBeforeRebate: number; rebate87A: number; surcharge: number; cess: number; totalTax: number; netPayable: number; refundDue: number }
interface Comparison { old: RegimeResult; new: RegimeResult; recommended: string; saving: number }

const AYS = ["2026-27", "2025-26"];

export default function IncomeTaxPage() {
  const [ay, setAy] = useState("2026-27");
  const [salary, setSalary] = useState(1200000);
  const [houseProperty, setHouseProperty] = useState(0);
  const [business, setBusiness] = useState(0);
  const [capitalGains, setCapitalGains] = useState(0);
  const [other, setOther] = useState(50000);
  const [d80c, setD80c] = useState(150000);
  const [d80d, setD80d] = useState(25000);
  const [advanceTax, setAdvanceTax] = useState(0);
  const [tdsCredit, setTdsCredit] = useState(80000);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [form, setForm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const compute = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await apiPost<{ comparison: Comparison; form: string }>("/api/tax/income-tax", {
        assessmentYear: ay, salary, houseProperty, business, capitalGains, other,
        deductions: { "80C": d80c, "80D": d80d }, isSalaried: salary > 0, advanceTaxPaid: advanceTax, tdsCredit,
      });
      setComparison(r.comparison); setForm(r.form);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const Col = ({ r, recommended }: { r: RegimeResult; recommended: boolean }) => (
    <div className={`rounded-xl border p-4 ${recommended ? "border-emerald-500 bg-emerald-500/5" : "border-border"}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{r.regime} regime</h3>
        {recommended && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-500">Recommended</span>}
      </div>
      {[
        ["Gross total income", r.grossTotalIncome],
        ["Deductions", r.totalDeductions],
        ["Taxable income", r.taxableIncome],
        ["Tax before rebate", r.taxBeforeRebate],
        ["Rebate 87A", -r.rebate87A],
        ["Surcharge", r.surcharge],
        ["Health & edu cess", r.cess],
      ].map(([l, v]) => (
        <div key={l as string} className="flex justify-between border-b border-border/50 py-1 text-sm">
          <span className="text-muted-foreground">{l}</span><span>{formatINR(v as number)}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between text-sm font-bold"><span>Total tax</span><span>{formatINR(r.totalTax)}</span></div>
      <div className="mt-1 flex justify-between text-sm"><span className="text-muted-foreground">Net payable / (refund)</span><span className={r.refundDue > 0 ? "text-emerald-500" : ""}>{r.refundDue > 0 ? `(${formatINR(r.refundDue)})` : formatINR(r.netPayable)}</span></div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Income Tax"
        subtitle="Old vs new regime · slabs/surcharge/cess from versioned config · auto ITR selection"
        icon={<Coins size={20} />}
        actions={<><Select value={ay} onChange={setAy} options={AYS.map((y) => ({ value: y, label: `AY ${y}` }))} /><Btn onClick={compute} disabled={busy}><Calculator size={14} />{busy ? "Computing…" : "Compute"}</Btn></>}
      />
      {err && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-500">{err}</div>}

      <Section title="Income & deductions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Salary"><NumInput value={salary} onChange={setSalary} /></Field>
          <Field label="House property"><NumInput value={houseProperty} onChange={setHouseProperty} /></Field>
          <Field label="Business / profession"><NumInput value={business} onChange={setBusiness} /></Field>
          <Field label="Capital gains"><NumInput value={capitalGains} onChange={setCapitalGains} /></Field>
          <Field label="Other sources"><NumInput value={other} onChange={setOther} /></Field>
          <Field label="80C"><NumInput value={d80c} onChange={setD80c} /></Field>
          <Field label="80D"><NumInput value={d80d} onChange={setD80d} /></Field>
          <Field label="Advance tax paid"><NumInput value={advanceTax} onChange={setAdvanceTax} /></Field>
          <Field label="TDS credit"><NumInput value={tdsCredit} onChange={setTdsCredit} /></Field>
        </div>
      </Section>

      {comparison && (
        <>
          <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Recommended regime" value={comparison.recommended} tone="good" />
            <StatCard label="Tax saving" value={formatINR(comparison.saving)} tone="good" />
            <StatCard label="Suggested ITR form" value={form ?? "—"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Col r={comparison.old} recommended={comparison.recommended === "OLD"} />
            <Col r={comparison.new} recommended={comparison.recommended === "NEW"} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">A filing has been created in <b className="text-foreground">READY</b> state for the recommended regime — review &amp; approve it under <a className="text-primary hover:underline" href="/tax/gst/filing">Filing</a>.</p>
        </>
      )}
    </div>
  );
}
