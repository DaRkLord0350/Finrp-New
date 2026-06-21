"use client";

import { useEffect, useState } from "react";
import { Gauge, RefreshCw } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, StatusBadge, apiGet } from "../../_components/ui";

interface JobRun { id: string; jobName: string; status: string; createdAt: string; errorMessage?: string | null }
interface Recon { id: string; period: string; matchedCount: number; mismatchCount: number }
interface AuditRow { id: string; action: string; entity: string; description: string; createdAt: string }
interface Counts { waiting: number; active: number; completed: number; failed: number }
interface AdminData {
  provider: { name: string; isLive: boolean; health: { ok: boolean; detail: string } };
  queue: { tax: Counts | null; dlq: { waiting: number; failed: number } | null };
  filingStatus: Record<string, number>;
  recentJobs: JobRun[];
  failedValidations: { id: string; subjectType: string; errorCount: number; createdAt: string }[];
  reconciliations: Recon[];
  auditLogs: AuditRow[];
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => { try { setData(await apiGet<AdminData>("/api/tax/admin")); } catch (e) { setErr((e as Error).message); } };
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await apiGet<AdminData>("/api/tax/admin");
        if (active) setData(d);
      } catch (e) {
        if (active) setErr((e as Error).message);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div>
      <PageHeader
        title="Engine Admin"
        subtitle="Filing status · provider health · job queue · validations · audit"
        icon={<Gauge size={20} />}
        actions={<Btn variant="ghost" onClick={load}><RefreshCw size={14} />Refresh</Btn>}
      />
      {err && <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-500">{err}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Filing provider" value={data?.provider.isLive ? "LIVE" : "Sandbox"} tone={data?.provider.health.ok ? "good" : "bad"} hint={data?.provider.name} />
        <StatCard label="Tax queue waiting" value={data?.queue.tax?.waiting ?? 0} />
        <StatCard label="Tax queue failed" value={data?.queue.tax?.failed ?? 0} tone={(data?.queue.tax?.failed ?? 0) > 0 ? "bad" : "good"} />
        <StatCard label="Dead-letter queue" value={data?.queue.dlq?.failed ?? 0} tone={(data?.queue.dlq?.failed ?? 0) > 0 ? "bad" : "good"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Filing status">
          <div className="flex flex-col gap-1.5">
            {Object.keys(data?.filingStatus ?? {}).length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No filings yet.</p>}
            {Object.entries(data?.filingStatus ?? {}).map(([s, c]) => (
              <div key={s} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                <StatusBadge status={s} /><span className="font-semibold">{c}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Provider / API health">
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <p className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${data?.provider.health.ok ? "bg-emerald-500" : "bg-red-500"}`} />{data?.provider.health.ok ? "Healthy" : "Unavailable"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data?.provider.health.detail}</p>
          </div>
        </Section>

        <Section title="Recent jobs">
          {(!data || data.recentJobs.length === 0) ? <p className="py-4 text-center text-sm text-muted-foreground">No jobs run yet.</p> : (
            <div className="flex flex-col gap-1.5">
              {data.recentJobs.slice(0, 10).map((j) => (
                <div key={j.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
                  <span className="font-mono">{j.jobName}</span>
                  <StatusBadge status={j.status} />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Recent reconciliations">
          {(!data || data.reconciliations.length === 0) ? <p className="py-4 text-center text-sm text-muted-foreground">None yet.</p> : (
            <div className="flex flex-col gap-1.5">
              {data.reconciliations.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
                  <span>{r.period}</span>
                  <span><span className="text-emerald-500">{r.matchedCount} matched</span> · <span className="text-red-500">{r.mismatchCount} mismatch</span></span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Failed validations">
          {(!data || data.failedValidations.length === 0) ? <p className="py-4 text-center text-sm text-muted-foreground">No failing validations.</p> : (
            <div className="flex flex-col gap-1.5">
              {data.failedValidations.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-md bg-red-500/5 px-3 py-2 text-xs">
                  <span>{v.subjectType}</span><span className="text-red-500">{v.errorCount} errors</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Audit log">
          {(!data || data.auditLogs.length === 0) ? <p className="py-4 text-center text-sm text-muted-foreground">No tax activity yet.</p> : (
            <ol className="flex flex-col gap-1.5">
              {data.auditLogs.slice(0, 12).map((a) => (
                <li key={a.id} className="text-xs text-muted-foreground">
                  <span className="font-mono text-[10px]">{new Date(a.createdAt).toLocaleString("en-IN")}</span> · <span className="font-medium text-foreground">{a.entity}</span> — {a.description}
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </div>
  );
}
