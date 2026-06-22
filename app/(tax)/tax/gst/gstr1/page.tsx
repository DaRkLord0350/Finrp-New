"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck2, Download, Play } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, PeriodSelect, apiGet, apiPost, formatINR } from "../../../_components/ui";

interface Finding { ruleCode: string; severity: string; message: string; blocking: boolean }
interface Summary { b2bCount: number; b2clCount: number; b2csCount: number; cdnrCount: number; expCount: number; totalTaxable: number; totalTax: number }

export default function Gstr1Page() {
  const [period, setPeriod] = useState("052025");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadExisting = async (p: string) => {
    const r = await apiGet<{ dataset: { summary?: Summary; payload?: Record<string, unknown> } | null }>(`/api/tax/gst/gstr1?period=${p}`).catch(() => ({ dataset: null }));
    setSummary(r.dataset?.summary ?? null);
    setPayload(r.dataset?.payload ?? null);
  };
  useEffect(() => { setFindings([]); loadExisting(period).catch((e) => setErr(e.message)); }, [period]);

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await apiPost<{ summary: Summary; payload: Record<string, unknown>; validation: { findings: Finding[]; blocked: boolean } }>("/api/tax/gst/gstr1", { period });
      setSummary(r.summary);
      setPayload(r.payload);
      setFindings(r.validation.findings);
      setBlocked(r.validation.blocked);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const download = () => {
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `GSTR1_${period}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const errors = findings.filter((f) => f.severity === "ERROR");
  const warnings = findings.filter((f) => f.severity === "WARNING");

  return (
    <div>
      <PageHeader
        title="GSTR-1"
        subtitle="Outward supplies return — government-compatible JSON"
        icon={<FileCheck2 size={20} />}
        actions={
          <>
            <PeriodSelect value={period} onChange={setPeriod} />
            <Btn onClick={generate} disabled={busy}><Play size={14} />{busy ? "Generating…" : "Validate & Generate"}</Btn>
            <Btn variant="ghost" onClick={download} disabled={!payload}><Download size={14} />JSON</Btn>
          </>
        }
      />
      {err && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-500">{err}</div>}

      {blocked && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          Validation has blocking errors — resolve them before this return can be marked ready for filing.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard label="B2B" value={summary?.b2bCount ?? 0} />
        <StatCard label="B2C Large" value={summary?.b2clCount ?? 0} />
        <StatCard label="B2C Small" value={summary?.b2csCount ?? 0} />
        <StatCard label="CDNR" value={summary?.cdnrCount ?? 0} />
        <StatCard label="Exports" value={summary?.expCount ?? 0} />
        <StatCard label="Output tax" value={formatINR(summary?.totalTax ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`Validation (${errors.length} errors · ${warnings.length} warnings)`}>
          {findings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Run “Validate & Generate” to see findings.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {findings.map((f, i) => (
                <li key={i} className={`rounded-md px-3 py-2 text-sm ${f.severity === "ERROR" ? "bg-red-500/10 text-red-500" : f.severity === "WARNING" ? "bg-amber-500/10 text-amber-600" : "bg-muted"}`}>
                  <span className="font-mono text-[10px] opacity-70">{f.ruleCode}</span> · {f.message}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Next step">
          <p className="text-sm text-muted-foreground">Once generated without blocking errors, the GSTR-1 is marked <b className="text-foreground">READY</b> in the filing workflow. Filing requires explicit CA approval.</p>
          <Link href="/tax/gst/filing" className="mt-3 inline-block text-sm text-primary hover:underline">Go to Filing →</Link>
          {payload != null && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">Preview payload JSON</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-[11px]">{JSON.stringify(payload, null, 2)}</pre>
            </details>
          )}
        </Section>
      </div>
    </div>
  );
}
