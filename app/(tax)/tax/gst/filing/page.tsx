"use client";

import { useEffect, useState } from "react";
import { Send, ShieldCheck, CheckCircle2, XCircle, History } from "lucide-react";
import { PageHeader, Section, Btn, StatusBadge, apiGet, apiPost } from "../../../_components/ui";

interface Submission {
  id: string; returnType: string; period: string; gstin?: string | null;
  status: string; arn?: string | null; ackNo?: string | null; errorMessage?: string | null;
}
interface LogRow { id: string; event: string; fromStatus?: string | null; toStatus?: string | null; detail?: string | null; createdAt: string }

export default function FilingPage() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [history, setHistory] = useState<Record<string, LogRow[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await apiGet<{ submissions: Submission[] }>("/api/tax/filing?scheme=GST");
    setSubs(r.submissions);
  };
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  const act = async (id: string, path: string, body?: unknown) => {
    setBusy(id + path); setMsg(null);
    try { await apiPost(`/api/tax/filing/${id}/${path}`, body); await load(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  };

  const toggleHistory = async (id: string) => {
    if (history[id]) { setHistory((h) => { const n = { ...h }; delete n[id]; return n; }); return; }
    const r = await apiGet<{ history: LogRow[] }>(`/api/tax/filing/${id}`);
    setHistory((h) => ({ ...h, [id]: r.history }));
  };

  return (
    <div>
      <PageHeader
        title="Filing"
        subtitle="Review checkpoint — no return is submitted without explicit CA approval"
        icon={<Send size={20} />}
      />
      {msg && <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{msg}</div>}

      {subs.length === 0 ? (
        <Section><p className="py-8 text-center text-sm text-muted-foreground">No filings yet. Generate a GSTR-1 or GSTR-3B to create one.</p></Section>
      ) : (
        <div className="flex flex-col gap-3">
          {subs.map((s) => (
            <Section key={s.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-semibold">{s.returnType} <span className="text-muted-foreground">· {s.period}</span></p>
                    <p className="text-[11px] text-muted-foreground">{s.gstin}</p>
                  </div>
                  <StatusBadge status={s.status} />
                  {s.arn && <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-500">ARN {s.arn}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {s.status === "READY" && (
                    <Btn onClick={() => act(s.id, "submit-for-approval")} disabled={!!busy}><ShieldCheck size={14} />Submit for approval</Btn>
                  )}
                  {s.status === "PENDING_APPROVAL" && (
                    <>
                      <Btn onClick={() => act(s.id, "approve")} disabled={!!busy}><CheckCircle2 size={14} />Approve</Btn>
                      <Btn variant="danger" onClick={() => act(s.id, "reject", { reason: "Rejected during review" })} disabled={!!busy}><XCircle size={14} />Reject</Btn>
                    </>
                  )}
                  {s.status === "APPROVED" && (
                    <Btn onClick={() => act(s.id, "file", { signatureType: "EVC" })} disabled={!!busy}><Send size={14} />File now</Btn>
                  )}
                  {(s.status === "REJECTED" || s.status === "FAILED") && (
                    <span className="text-xs text-red-500">{s.errorMessage}</span>
                  )}
                  <Btn variant="ghost" onClick={() => toggleHistory(s.id)}><History size={14} />History</Btn>
                </div>
              </div>

              {history[s.id] && (
                <div className="mt-3 border-t border-border pt-3">
                  <ol className="flex flex-col gap-1.5">
                    {history[s.id].map((l) => (
                      <li key={l.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono text-[10px]">{new Date(l.createdAt).toLocaleString("en-IN")}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">{l.event.replace(/_/g, " ")}</span>
                        {l.fromStatus && <span>{l.fromStatus} → {l.toStatus}</span>}
                        {l.detail && <span className="truncate">· {l.detail}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}
