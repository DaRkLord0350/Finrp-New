"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReceiptText, FileCheck2, Calculator, GitCompareArrows } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, PeriodSelect, apiGet, apiPost, formatINR } from "../../_components/ui";

export default function GstDashboard() {
  const [period, setPeriod] = useState("052025");
  const [gstr1, setGstr1] = useState<{ summary?: { totalTaxable: number; totalTax: number; b2bCount: number } } | null>(null);
  const [gstr3b, setGstr3b] = useState<{ netIgst: number; netCgst: number; netSgst: number; outwardTaxable: number } | null>(null);
  const [recon, setRecon] = useState<{ matchedCount: number; mismatchCount: number; itcDifference: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async (p: string) => {
    setErr(null);
    const [d1, d3, r] = await Promise.all([
      apiGet<{ dataset: { summary?: { totalTaxable: number; totalTax: number; b2bCount: number } } | null }>(`/api/tax/gst/gstr1?period=${p}`).catch(() => ({ dataset: null })),
      apiGet<{ computation: { netIgst: number; netCgst: number; netSgst: number; outwardTaxable: number } | null }>(`/api/tax/gst/gstr3b?period=${p}`).catch(() => ({ computation: null })),
      apiGet<{ reconciliation: { matchedCount: number; mismatchCount: number; itcDifference: number } | null }>(`/api/tax/gst/reconcile?period=${p}`).catch(() => ({ reconciliation: null })),
    ]);
    setGstr1(d1.dataset ? { summary: d1.dataset.summary } : null);
    setGstr3b(d3.computation as never);
    setRecon(r.reconciliation as never);
  };

  useEffect(() => { load(period).catch((e) => setErr(e.message)); }, [period]);

  const run = async (action: "gstr1" | "gstr3b" | "reconcile") => {
    setBusy(action); setErr(null);
    try {
      if (action === "gstr1") await apiPost("/api/tax/gst/gstr1", { period });
      if (action === "gstr3b") await apiPost("/api/tax/gst/gstr3b", { period });
      if (action === "reconcile") await apiPost("/api/tax/gst/reconcile", { period });
      await load(period);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const net3b = gstr3b ? Number(gstr3b.netIgst) + Number(gstr3b.netCgst) + Number(gstr3b.netSgst) : 0;

  return (
    <div>
      <PageHeader
        title="GST Dashboard"
        subtitle="GSTR-1 · GSTR-3B · 2B reconciliation"
        icon={<ReceiptText size={20} />}
        actions={<PeriodSelect value={period} onChange={setPeriod} />}
      />
      {err && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-500">{err}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Outward taxable" value={formatINR(gstr1?.summary?.totalTaxable ?? gstr3b?.outwardTaxable ?? 0)} />
        <StatCard label="Output tax (GSTR-1)" value={formatINR(gstr1?.summary?.totalTax ?? 0)} />
        <StatCard label="Net 3B cash payable" value={formatINR(net3b)} tone={net3b > 0 ? "warn" : "good"} />
        <StatCard label="ITC difference (2B)" value={formatINR(recon?.itcDifference ?? 0)} tone={recon && recon.itcDifference > 0 ? "bad" : "good"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="GSTR-1" right={<Btn variant="ghost" onClick={() => run("gstr1")} disabled={busy === "gstr1"}><FileCheck2 size={14} />{busy === "gstr1" ? "…" : "Generate"}</Btn>}>
          <p className="text-sm text-muted-foreground">B2B invoices: <span className="font-medium text-foreground">{gstr1?.summary?.b2bCount ?? 0}</span></p>
          <p className="mt-1 text-sm text-muted-foreground">Output tax: <span className="font-medium text-foreground">{formatINR(gstr1?.summary?.totalTax ?? 0)}</span></p>
          <Link href="/tax/gst/gstr1" className="mt-3 inline-block text-sm text-primary hover:underline">Open GSTR-1 →</Link>
        </Section>

        <Section title="GSTR-3B" right={<Btn variant="ghost" onClick={() => run("gstr3b")} disabled={busy === "gstr3b"}><Calculator size={14} />{busy === "gstr3b" ? "…" : "Compute"}</Btn>}>
          <p className="text-sm text-muted-foreground">Net cash payable: <span className="font-medium text-foreground">{formatINR(net3b)}</span></p>
          <Link href="/tax/gst/gstr3b" className="mt-3 inline-block text-sm text-primary hover:underline">Open GSTR-3B →</Link>
        </Section>

        <Section title="2B Reconciliation" right={<Btn variant="ghost" onClick={() => run("reconcile")} disabled={busy === "reconcile"}><GitCompareArrows size={14} />{busy === "reconcile" ? "…" : "Reconcile"}</Btn>}>
          <p className="text-sm text-muted-foreground">Matched: <span className="font-medium text-emerald-500">{recon?.matchedCount ?? 0}</span> · Mismatches: <span className="font-medium text-red-500">{recon?.mismatchCount ?? 0}</span></p>
          <Link href="/tax/gst/reconcile" className="mt-3 inline-block text-sm text-primary hover:underline">Open reconciliation →</Link>
        </Section>
      </div>
    </div>
  );
}
