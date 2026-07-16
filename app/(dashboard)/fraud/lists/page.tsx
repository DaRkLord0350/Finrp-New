"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";

interface ListEntry { id: string; listType: string; entryType: string; value: string; reason: string | null; createdAt: string }

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function FraudListsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ entries: ListEntry[] }>(["fraud", "lists"], () => api("/api/fraud/lists"));
  const [form, setForm] = useState({ listType: "BLACKLIST", entryType: "PAN", value: "", reason: "" });

  const add = async () => {
    if (!form.value) return toast.error("Value is required");
    try {
      await api("/api/fraud/lists", { method: "POST", body: JSON.stringify(form) });
      toast.success("Entry added");
      setForm((f) => ({ ...f, value: "", reason: "" }));
      qc.invalidate(["fraud", "lists"]);
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (id: string) => {
    try { await api(`/api/fraud/lists/${id}`, { method: "DELETE" }); toast.success("Entry removed"); qc.invalidate(["fraud", "lists"]); }
    catch (e) { toast.error((e as Error).message); }
  };

  const blacklist = data?.entries?.filter((e) => e.listType === "BLACKLIST") ?? [];
  const whitelist = data?.entries?.filter((e) => e.listType === "WHITELIST") ?? [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Blacklist / Whitelist</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>PAN, Aadhaar hash, email, phone, device fingerprint, or IP entries checked during every fraud screen</p>

      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 2fr auto", gap: 8 }}>
          <select value={form.listType} onChange={(e) => setForm((f) => ({ ...f, listType: e.target.value }))} style={inputStyle}>
            <option value="BLACKLIST">Blacklist</option>
            <option value="WHITELIST">Whitelist</option>
          </select>
          <select value={form.entryType} onChange={(e) => setForm((f) => ({ ...f, entryType: e.target.value }))} style={inputStyle}>
            {["PAN", "AADHAAR_HASH", "EMAIL", "PHONE", "DEVICE_FINGERPRINT", "IP_ADDRESS"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          <input placeholder="Value" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} style={inputStyle} />
          <input placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} style={inputStyle} />
          <button onClick={add} style={primaryBtn}><Plus size={14} /></button>
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <ListCard title="Blacklist" entries={blacklist} onRemove={remove} />
          <ListCard title="Whitelist" entries={whitelist} onRemove={remove} />
        </div>
      )}
    </div>
  );
}

function ListCard({ title, entries, onRemove }: { title: string; entries: ListEntry[]; onRemove: (id: string) => void }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title} ({entries.length})</h3>
      {entries.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No entries.</p>}
      {entries.map((e) => (
        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{e.entryType.replace(/_/g, " ")}: {e.value}</p>
            {e.reason && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.reason}</p>}
          </div>
          <button onClick={() => onRemove(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)" };
const primaryBtn: React.CSSProperties = { padding: "8px 14px", background: "#6366f1", color: "#fff", borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
