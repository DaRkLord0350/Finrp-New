"use client";

import { useEffect, useState } from "react";
import { Calculator, Play } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, PeriodSelect, apiGet, apiPost, formatINR } from "../../../_components/ui";

interface Comp {
  outwardTaxable: string; outwardIgst: string; outwardCgst: string; outwardSgst: string;
  itcIgst: string; itcCgst: string; itcSgst: string;
  netIgst: string; netCgst: string; netSgst: string;
}

const heads = ["igst", "cgst", "sgst"] as const;

export default function Gstr3bPage() {
  const [period, setPeriod] = useState("052025");
  const [comp, setComp] = useState<Comp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async (p: string) => {
    const r = await apiGet<{ computation: Comp | null }>(`/api/tax/gst/gstr3b?period=${p}`).catch(() => ({ computation: null }));
    setComp(r.computation);
  };
  useEffect(() => { load(period).catch((e) => setErr(e.message)); }, [period]);

  const compute = async () => {
    setBusy(true); setErr(null);
    try { await apiPost("/api/tax/gst/gstr3b", { period }); await load(period); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const v = (k: keyof Comp) => Number(comp?.[k] ?? 0);
  const netTotal = v("netIgst") + v("netCgst") + v("netSgst");

  return (
    <div>
      <PageHeader
        title="GSTR-3B"
        subtitle="Summary return — net cash liability after ITC set-off & carry-forward"
        icon={<Calculator size={20} />}
        actions={<><PeriodSelect value={period} onChange={setPeriod} /><Btn onClick={compute} disabled={busy}><Play size={14} />{busy ? "Computing…" : "Compute"}</Btn></>}
      />
      {err && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-500">{err}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Outward taxable (3.1)" value={formatINR(v("outwardTaxable"))} />
        <StatCard label="ITC available (4)" value={formatINR(v("itcIgst") + v("itcCgst") + v("itcSgst"))} tone="good" />
        <StatCard label="Net cash payable (6.1)" value={formatINR(netTotal)} tone={netTotal > 0 ? "warn" : "good"} />
      </div>

      <Section title="Tax computation worksheet">
        {!comp ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Click “Compute” to build the GSTR-3B worksheet for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Head</th>
                  <th className="px-3 py-2 text-right">Output tax</th>
                  <th className="px-3 py-2 text-right">ITC</th>
                  <th className="px-3 py-2 text-right">Net cash payable</th>
                </tr>
              </thead>
              <tbody>
                {heads.map((h) => {
                  const out = v(`outward${h[0].toUpperCase()}${h.slice(1)}` as keyof Comp);
                  const itc = v(`itc${h[0].toUpperCase()}${h.slice(1)}` as keyof Comp);
                  const net = v(`net${h[0].toUpperCase()}${h.slice(1)}` as keyof Comp);
                  return (
                    <tr key={h} className="border-t border-border">
                      <td className="px-3 py-2 font-medium uppercase">{h}</td>
                      <td className="px-3 py-2 text-right">{formatINR(out)}</td>
                      <td className="px-3 py-2 text-right text-emerald-500">{formatINR(itc)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatINR(net)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border bg-muted/40 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{formatINR(v("outwardIgst") + v("outwardCgst") + v("outwardSgst"))}</td>
                  <td className="px-3 py-2 text-right text-emerald-500">{formatINR(v("itcIgst") + v("itcCgst") + v("itcSgst"))}</td>
                  <td className="px-3 py-2 text-right">{formatINR(netTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
