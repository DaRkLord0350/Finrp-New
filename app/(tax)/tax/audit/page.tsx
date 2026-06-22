"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, FileText, PenLine } from "lucide-react";
import { PageHeader, Section, Btn, Select, FYSelect, StatusBadge, apiGet, apiPost } from "../../_components/ui";

interface FormDef { form: string; title: string }
interface Report { id: string; formType: string; financialYear: string; status: string; udin?: string | null; data: { title: string; sections: { title: string; rows: { label: string; value: string | number }[] }[] } }

export default function AuditPage() {
  const [fy, setFy] = useState("2025-26");
  const [forms, setForms] = useState<FormDef[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selForm, setSelForm] = useState("FORM_3CD");
  const [active, setActive] = useState<Report | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await apiGet<{ reports: Report[]; forms: FormDef[] }>(`/api/tax/audit?fy=${fy}`);
    setForms(r.forms); setReports(r.reports);
  };
  useEffect(() => {
    let active = true;
    void (async () => { try { await load(); } catch (e) { if (active) setMsg((e as Error).message); } })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy]);

  const generate = async () => {
    try { const r = await apiPost<{ report: Report; built: Report["data"] }>("/api/tax/audit", { formType: selForm, financialYear: fy }); setActive({ ...r.report, data: r.built }); setMsg(`Generated ${selForm}.`); await load(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const sign = async (id: string) => {
    const udin = prompt("Enter UDIN to sign this report:");
    if (!udin) return;
    try { await apiPost(`/api/tax/audit/${id}/approve`, { udin }); setMsg("Report signed with UDIN."); await load(); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div>
      <PageHeader
        title="Audit Reports"
        subtitle="3CA · 3CB · 3CD · 10B · 29B · 29C · 3CEB — reusable generation pipeline"
        icon={<ShieldCheck size={20} />}
        actions={<><FYSelect value={fy} onChange={setFy} /><Select value={selForm} onChange={setSelForm} options={forms.map((f) => ({ value: f.form, label: f.form.replace("FORM_", "Form ") }))} /><Btn onClick={generate}><FileText size={14} />Generate</Btn></>}
      />
      {msg && <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Reports">
          {reports.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No reports generated for {fy}.</p> : (
            <div className="flex flex-col gap-2">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <button onClick={() => setActive(r)} className="flex items-center gap-2 text-left text-sm">
                    <span className="font-medium">{r.formType.replace("FORM_", "Form ")}</span>
                    <StatusBadge status={r.status} />
                    {r.udin && <span className="text-[11px] text-muted-foreground">UDIN {r.udin}</span>}
                  </button>
                  {r.status !== "APPROVED" && <Btn variant="ghost" onClick={() => sign(r.id)}><PenLine size={13} />Sign</Btn>}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={active ? active.data.title : "Report preview"}>
          {!active ? <p className="py-6 text-center text-sm text-muted-foreground">Generate or select a report to preview.</p> : (
            <div className="flex flex-col gap-3">
              {active.data.sections.map((s) => (
                <div key={s.title}>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{s.title}</p>
                  {s.rows.map((row) => (
                    <div key={row.label} className="flex justify-between border-b border-border/40 py-1 text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="text-right">{typeof row.value === "number" ? new Intl.NumberFormat("en-IN").format(row.value) : row.value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
