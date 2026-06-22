"use client";

import { useEffect, useState } from "react";
import { Landmark, Plus, Calculator } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, Field, TextInput, NumInput, Select, FYSelect, apiGet, apiPost, formatINR } from "../../_components/ui";

interface Deductee { id: string; name: string; panMasked?: string | null; deducteeType: string }
interface Deduction { id: string; section: string; amountPaid: string; tdsDeducted: string; tdsRate: string; deductee: { name: string; panMasked?: string | null } }
interface Computation { totalDeducted: string; totalDeposited: string; shortfall: string; deducteeCount: number }

const SECTIONS = ["192", "194A", "194C", "194H", "194I", "194J", "194Q", "206C(1H)"];
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

export default function TdsPage() {
  const [fy, setFy] = useState("2025-26");
  const [quarter, setQuarter] = useState<(typeof QUARTERS)[number]>("Q1");
  const [deductees, setDeductees] = useState<Deductee[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [comp, setComp] = useState<Computation | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // forms
  const [dName, setDName] = useState(""); const [dPan, setDPan] = useState(""); const [dType, setDType] = useState("INDIVIDUAL");
  const [section, setSection] = useState("194C"); const [deducteeId, setDeducteeId] = useState(""); const [amount, setAmount] = useState(0); const [payDate, setPayDate] = useState("2025-04-15");

  const load = async () => {
    const [d, x, c] = await Promise.all([
      apiGet<{ deductees: Deductee[] }>("/api/tax/tds/deductees"),
      apiGet<{ deductions: Deduction[] }>(`/api/tax/tds/deductions?fy=${fy}&quarter=${quarter}`),
      apiGet<{ computations: Computation[] }>(`/api/tax/tds/compute?fy=${fy}`),
    ]);
    setDeductees(d.deductees);
    setDeductions(x.deductions);
    setComp(c.computations[0] ?? null);
    if (d.deductees[0] && !deducteeId) setDeducteeId(d.deductees[0].id);
  };
  useEffect(() => {
    let active = true;
    void (async () => { try { await load(); } catch (e) { if (active) setMsg((e as Error).message); } })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy, quarter]);

  const addDeductee = async () => {
    if (!dName) return;
    try { await apiPost("/api/tax/tds/deductees", { name: dName, pan: dPan || undefined, deducteeType: dType }); setDName(""); setDPan(""); await load(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const addDeduction = async () => {
    if (!deducteeId) { setMsg("Add a deductee first"); return; }
    try { const r = await apiPost<{ tdsDeducted: string; rate: string }>("/api/tax/tds/deductions", { deducteeId, section, financialYear: fy, quarter, paymentDate: payDate, amountPaid: amount }); setMsg(`TDS computed: ${formatINR(r.tdsDeducted)} @ ${r.rate}%`); setAmount(0); await load(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const computeReturn = async () => {
    try { await apiPost("/api/tax/tds/compute", { formType: "FORM_26Q", financialYear: fy, quarter }); setMsg("TDS return computed & filing created (status READY)."); await load(); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div>
      <PageHeader
        title="TDS / TCS"
        subtitle="Deductees · challans · section-rate deduction · quarterly returns (24Q/26Q/27Q)"
        icon={<Landmark size={20} />}
        actions={<><FYSelect value={fy} onChange={setFy} /><Select value={quarter} onChange={setQuarter} options={QUARTERS.map((q) => ({ value: q, label: q }))} /><Btn onClick={computeReturn}><Calculator size={14} />Compute return</Btn></>}
      />
      {msg && <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{msg}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Deductees" value={deductees.length} />
        <StatCard label="Total deducted" value={formatINR(comp?.totalDeducted ?? 0)} />
        <StatCard label="Total deposited" value={formatINR(comp?.totalDeposited ?? 0)} />
        <StatCard label="Shortfall" value={formatINR(comp?.shortfall ?? 0)} tone={comp && Number(comp.shortfall) > 0 ? "bad" : "good"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Add deductee">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name"><TextInput value={dName} onChange={(e) => setDName(e.target.value)} /></Field>
            <Field label="PAN (optional)"><TextInput value={dPan} onChange={(e) => setDPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" /></Field>
            <Field label="Type"><Select value={dType} onChange={setDType} options={["INDIVIDUAL", "COMPANY", "HUF", "FIRM", "OTHER"].map((t) => ({ value: t, label: t }))} /></Field>
          </div>
          <div className="mt-2"><Btn onClick={addDeductee} disabled={!dName}><Plus size={14} />Add deductee</Btn></div>
        </Section>

        <Section title="Record a deduction">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Deductee"><Select value={deducteeId} onChange={setDeducteeId} options={deductees.map((d) => ({ value: d.id, label: d.name }))} /></Field>
            <Field label="Section"><Select value={section} onChange={setSection} options={SECTIONS.map((s) => ({ value: s, label: s }))} /></Field>
            <Field label="Amount paid"><NumInput value={amount} onChange={setAmount} /></Field>
            <Field label="Payment date"><TextInput type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>
          </div>
          <div className="mt-2"><Btn onClick={addDeduction} disabled={deductees.length === 0}><Plus size={14} />Record (auto-computes TDS)</Btn></div>
        </Section>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Deductee</th><th className="px-3 py-2">Section</th><th className="px-3 py-2 text-right">Amount paid</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">TDS</th></tr>
          </thead>
          <tbody>
            {deductions.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No deductions for {fy} {quarter}.</td></tr>
            ) : deductions.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-3 py-2">{d.deductee.name} <span className="text-[11px] text-muted-foreground">{d.deductee.panMasked ?? "NO PAN"}</span></td>
                <td className="px-3 py-2">{d.section}</td>
                <td className="px-3 py-2 text-right">{formatINR(d.amountPaid)}</td>
                <td className="px-3 py-2 text-right">{Number(d.tdsRate)}%</td>
                <td className="px-3 py-2 text-right font-medium">{formatINR(d.tdsDeducted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
