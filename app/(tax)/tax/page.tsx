"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, ReceiptText, Database, ArrowRight } from "lucide-react";
import { PageHeader, Section, StatCard, Btn, apiGet, apiPost } from "../_components/ui";

interface AdminData {
  provider: { name: string; isLive: boolean; health: { ok: boolean; detail: string } };
  filingStatus: Record<string, number>;
}
interface Profile { id: string; gstin: string; legalName?: string | null }

export default function TaxOverview() {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const [a, p] = await Promise.all([
      apiGet<AdminData>("/api/tax/admin"),
      apiGet<{ profiles: Profile[] }>("/api/tax/gst/profiles"),
    ]);
    setAdmin(a);
    setProfiles(p.profiles);
  };

  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  const seed = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await apiPost<{ period: string; outwardCreated: number; inwardCreated: number; records2b: number }>("/api/tax/seed", {});
      setMsg(`Loaded demo data for ${r.period}: ${r.outwardCreated} sales, ${r.inwardCreated} purchases, ${r.records2b} 2B records.`);
      await load();
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };

  const totalFilings = Object.values(admin?.filingStatus ?? {}).reduce((s, n) => s + n, 0);

  return (
    <div>
      <PageHeader
        title="Tax & Compliance Engine"
        subtitle="Cloud-native GST, TDS, Income Tax & Audit — workflow-driven, CA-approved filing"
        icon={<LayoutDashboard size={20} />}
        actions={<Btn onClick={seed} disabled={busy}><Database size={15} />{busy ? "Loading…" : "Load demo data"}</Btn>}
      />

      {msg && <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-2 text-sm">{msg}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="GST profiles" value={profiles.length} hint={profiles[0]?.gstin ?? "—"} />
        <StatCard label="Filings tracked" value={totalFilings} />
        <StatCard label="Acknowledged" value={admin?.filingStatus?.ACKNOWLEDGED ?? 0} tone="good" />
        <StatCard
          label="Filing provider"
          value={admin?.provider.isLive ? "LIVE" : "Sandbox"}
          tone={admin?.provider.isLive ? "good" : "warn"}
          hint={admin?.provider.name}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="GST workspace">
          <div className="flex flex-col gap-2">
            {[
              { href: "/tax/gst", label: "GST Dashboard", desc: "Liability & ITC snapshot" },
              { href: "/tax/gst/invoices", label: "Invoices", desc: "Import & classify B2B/B2C" },
              { href: "/tax/gst/gstr1", label: "GSTR-1", desc: "Generate outward return" },
              { href: "/tax/gst/gstr3b", label: "GSTR-3B", desc: "Net liability after ITC" },
              { href: "/tax/gst/reconcile", label: "2B Reconciliation", desc: "Books vs GSTR-2B" },
              { href: "/tax/gst/filing", label: "Filing", desc: "Review → approve → file" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-muted">
                <span className="flex items-center gap-2.5"><ReceiptText size={15} className="text-primary" /><span><span className="font-medium">{l.label}</span> <span className="text-muted-foreground">· {l.desc}</span></span></span>
                <ArrowRight size={15} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Section>

        <Section title="Filing status">
          {totalFilings === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No filings yet. Load demo data, then generate a GSTR-1.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(admin?.filingStatus ?? {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span>{status.replace(/_/g, " ")}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3">
            <Link href="/tax/admin" className="text-sm text-primary hover:underline">Open admin dashboard →</Link>
          </div>
        </Section>
      </div>
    </div>
  );
}
