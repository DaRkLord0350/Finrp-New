"use client";

import { useEffect, useState } from "react";
import { Settings2, CheckCircle2 } from "lucide-react";
import { PageHeader, Section, Btn, StatusBadge, apiGet, apiPost } from "../../../_components/ui";

interface Version { id: string; scheme: string; period: string; version: number; status: string; label?: string | null; organizationId: string | null }

export default function ConfigPage() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [supportedYears, setSupportedYears] = useState<string[]>([]);
  const [defaultPack, setDefaultPack] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const r = await apiGet<{ versions: Version[]; supportedYears: string[]; defaultPack: Record<string, unknown> }>("/api/tax/config?scheme=GST");
    setVersions(r.versions); setSupportedYears(r.supportedYears); setDefaultPack(r.defaultPack);
  };
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  const publish = async (id: string) => {
    setBusy(id); setMsg(null);
    try { await apiPost("/api/tax/config/publish", { versionId: id }); await load(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <PageHeader
        title="Config Versions"
        subtitle="Versioned, configurable computation logic — rates/slabs/limits by FY/AY (never hardcoded)"
        icon={<Settings2 size={20} />}
      />
      {msg && <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{msg}</div>}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Section title="Code rule-packs (defaults)">
          <p className="text-sm text-muted-foreground">Default packs shipped in code, used unless overridden by a published version:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {supportedYears.map((y) => <span key={y} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">FY {y}</span>)}
          </div>
          {defaultPack != null && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted-foreground">Preview active GST config</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-[11px]">{JSON.stringify((defaultPack as { gst?: unknown }).gst ?? defaultPack, null, 2)}</pre>
            </details>
          )}
        </Section>

        <Section title="How overrides work">
          <p className="text-sm text-muted-foreground">
            Publish a <b className="text-foreground">TaxConfigVersion</b> to override any subset of a rule-pack for your org and a specific FY/AY.
            Published versions are immutable and deep-merge over the code default. Resolution order:
          </p>
          <ol className="mt-2 list-decimal pl-5 text-sm text-muted-foreground">
            <li>Published org-specific version</li>
            <li>Published global version</li>
            <li>Code rule-pack default</li>
          </ol>
        </Section>
      </div>

      <Section title="Stored versions">
        {versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No override versions stored. The engine is running on code defaults.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2">Scheme</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Version</th><th className="px-3 py-2">Scope</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className="border-t border-border">
                    <td className="px-3 py-2">{v.scheme}</td>
                    <td className="px-3 py-2">{v.period}</td>
                    <td className="px-3 py-2">v{v.version} {v.label && <span className="text-muted-foreground">· {v.label}</span>}</td>
                    <td className="px-3 py-2">{v.organizationId ? "Org" : "Global"}</td>
                    <td className="px-3 py-2"><StatusBadge status={v.status} /></td>
                    <td className="px-3 py-2 text-right">{v.status !== "PUBLISHED" && <Btn variant="ghost" onClick={() => publish(v.id)} disabled={busy === v.id}><CheckCircle2 size={13} />Publish</Btn>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
