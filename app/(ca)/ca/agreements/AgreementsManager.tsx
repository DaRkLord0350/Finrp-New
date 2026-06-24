"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Building2, UserCircle, Loader2, Check } from "lucide-react";

export interface CustomerOption {
  id: string;
  name: string;
  company: string | null;
}
export interface AgreementDTO {
  id: string;
  customerId: string;
  kind: "FIRM" | "CUSTOMER";
  serviceScope: string | null;
  renewalDate: string | null; // yyyy-mm-dd
  monthlyFee: number | null;
  slaHours: number | null;
  notes: string | null;
  status: string;
}

type Draft = {
  serviceScope: string;
  renewalDate: string;
  monthlyFee: string;
  slaHours: string;
  notes: string;
  status: string;
};

const emptyDraft: Draft = { serviceScope: "", renewalDate: "", monthlyFee: "", slaHours: "", notes: "", status: "ACTIVE" };

function toDraft(a?: AgreementDTO): Draft {
  if (!a) return { ...emptyDraft };
  return {
    serviceScope: a.serviceScope ?? "",
    renewalDate: a.renewalDate ?? "",
    monthlyFee: a.monthlyFee != null ? String(a.monthlyFee) : "",
    slaHours: a.slaHours != null ? String(a.slaHours) : "",
    notes: a.notes ?? "",
    status: a.status,
  };
}

export default function AgreementsManager({ customers, agreements }: { customers: CustomerOption[]; agreements: AgreementDTO[] }) {
  const [selected, setSelected] = useState(customers[0]?.id ?? "");

  const byCustomer = useMemo(() => {
    const m = new Map<string, { FIRM?: AgreementDTO; CUSTOMER?: AgreementDTO }>();
    for (const a of agreements) {
      const cur = m.get(a.customerId) ?? {};
      cur[a.kind] = a;
      m.set(a.customerId, cur);
    }
    return m;
  }, [agreements]);

  if (customers.length === 0) {
    return (
      <div className="section-card">
        <div className="empty-state">
          <FileSignature size={44} color="var(--text-muted)" />
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No clients</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Agreements appear once you have assigned clients.</p>
        </div>
      </div>
    );
  }

  const pair = byCustomer.get(selected) ?? {};

  return (
    <>
      <div style={{ marginBottom: 20, maxWidth: 360 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Client</label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="ag-select">
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <AgreementCard kind="FIRM" customerId={selected} existing={pair.FIRM} />
        <AgreementCard kind="CUSTOMER" customerId={selected} existing={pair.CUSTOMER} />
      </div>

      <style>{`
        .ag-select { width: 100%; padding: 9px 11px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 13px; outline: none; cursor: pointer; }
        .ag-input { width: 100%; padding: 8px 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 12.5px; outline: none; }
      `}</style>
    </>
  );
}

function AgreementCard({ kind, customerId, existing }: { kind: "FIRM" | "CUSTOMER"; customerId: string; existing?: AgreementDTO }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(toDraft(existing));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when switching customer/agreement.
  const key = `${customerId}-${kind}-${existing?.id ?? "new"}`;
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setDraft(toDraft(existing));
    setSaved(false);
    setError(null);
  }

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/ca/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          kind,
          serviceScope: draft.serviceScope || null,
          renewalDate: draft.renewalDate || null,
          monthlyFee: draft.monthlyFee === "" ? null : Number(draft.monthlyFee),
          slaHours: draft.slaHours === "" ? null : Number(draft.slaHours),
          notes: draft.notes || null,
          status: draft.status,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "Save failed");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const Icon = kind === "FIRM" ? Building2 : UserCircle;
  const accent = kind === "FIRM" ? "#6366f1" : "#0ea5e9";

  return (
    <div className="section-card">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} color={accent} />
        </div>
        <div>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)" }}>{kind === "FIRM" ? "Firm Agreement" : "Customer Agreement"}</h3>
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{existing ? "Editing existing terms" : "Not set up yet"}</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="ag-label">Service Scope</label>
          <textarea value={draft.serviceScope} onChange={(e) => setDraft({ ...draft, serviceScope: e.target.value })} className="ag-input" rows={2} placeholder="e.g. GST filing, bookkeeping, annual ROC" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="ag-label">Renewal Date</label>
            <input type="date" value={draft.renewalDate} onChange={(e) => setDraft({ ...draft, renewalDate: e.target.value })} className="ag-input" />
          </div>
          <div>
            <label className="ag-label">Monthly Fee (₹)</label>
            <input type="number" value={draft.monthlyFee} onChange={(e) => setDraft({ ...draft, monthlyFee: e.target.value })} className="ag-input" placeholder="0" />
          </div>
          <div>
            <label className="ag-label">SLA (hours)</label>
            <input type="number" value={draft.slaHours} onChange={(e) => setDraft({ ...draft, slaHours: e.target.value })} className="ag-input" placeholder="48" />
          </div>
          <div>
            <label className="ag-label">Status</label>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="ag-input" style={{ cursor: "pointer" }}>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>
        <div>
          <label className="ag-label">Notes</label>
          <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="ag-input" rows={2} placeholder="Any special terms…" />
        </div>
      </div>

      {error && <p style={{ fontSize: 12, color: "#ef4444", marginTop: 10 }}>{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: `linear-gradient(135deg,${accent},#0ea5e9)`, color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <FileSignature size={14} />}
        {saved ? "Saved" : existing ? "Update Agreement" : "Create Agreement"}
      </button>

      <style>{`.ag-label { font-size: 11px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px; }`}</style>
    </div>
  );
}
