"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Shuffle, History, Search, ArrowRight, CheckCircle2, Clock } from "lucide-react";

export interface AssignCustomer {
  id: string;
  name: string;
  company: string | null;
  isActive: boolean;
  assignedCaId: string | null;
  assignedCaName: string | null;
}

export interface AssignCa {
  id: string;
  name: string;
  customerCount: number;
}

export interface AssignHistoryRow {
  id: string;
  customerName: string;
  caName: string;
  assignedByName: string | null;
  reason: string | null;
  isActive: boolean;
  assignedAt: string;
  unassignedAt: string | null;
}

type Tab = "assign" | "reassign" | "history";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function AssignmentsClient({
  customers,
  cas,
  history,
}: {
  customers: AssignCustomer[];
  cas: AssignCa[];
  history: AssignHistoryRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("assign");
  const [busy, setBusy] = useState(false);

  // Assign tab
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"ALL" | "ASSIGNED" | "UNASSIGNED">("UNASSIGNED");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignCaId, setAssignCaId] = useState("");

  // Reassign tab
  const [fromCaId, setFromCaId] = useState("");
  const [toCaId, setToCaId] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (scope === "ASSIGNED" && !c.assignedCaId) return false;
      if (scope === "UNASSIGNED" && c.assignedCaId) return false;
      if (q && !`${c.name} ${c.company ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [customers, search, scope]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id))));
  }

  async function bulk(payload: Record<string, unknown>, successMsg: (n: number) => string) {
    setBusy(true);
    try {
      const res = await fetch("/api/firm/assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const moved = Number(data.moved ?? 0);
      if (moved === 0) toast.info("Nothing to move — already assigned to that CA.");
      else toast.success(successMsg(moved));
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function doAssign() {
    if (!assignCaId) return toast.error("Select a CA to assign to");
    if (selected.size === 0) return toast.error("Select at least one customer");
    bulk({ toCaId: assignCaId, customerIds: [...selected] }, (n) => `${n} customer${n !== 1 ? "s" : ""} assigned`);
  }

  function doReassign() {
    if (!fromCaId || !toCaId) return toast.error("Select both CAs");
    if (fromCaId === toCaId) return toast.error("Pick two different CAs");
    bulk({ fromCaId, toCaId }, (n) => `${n} customer${n !== 1 ? "s" : ""} reassigned`);
  }

  const fromCount = cas.find((c) => c.id === fromCaId)?.customerCount ?? 0;
  const totalAssigned = customers.filter((c) => c.assignedCaId).length;

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Assignments</h1>
        <p className="section-subtitle">
          {customers.length} customers · {totalAssigned} assigned · {customers.length - totalAssigned} unassigned
        </p>
      </div>

      {/* CA workload */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
        {cas.map((c) => (
          <div key={c.id} className="stat-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(99,102,241,0.12)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.customerCount} customer{c.customerCount !== 1 ? "s" : ""}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {([
          ["assign", "Assign", <Users key="i" size={14} />],
          ["reassign", "Bulk Reassign", <Shuffle key="i" size={14} />],
          ["history", `History (${history.length})`, <History key="i" size={14} />],
        ] as [Tab, string, React.ReactNode][]).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "transparent", border: "none", borderBottom: `2px solid ${tab === key ? "#6366f1" : "transparent"}`, color: tab === key ? "var(--text-primary)" : "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: -1 }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Assign tab */}
      {tab === "assign" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
              <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" style={{ width: "100%", padding: "9px 12px 9px 36px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13 }} />
            </div>
            {(["UNASSIGNED", "ASSIGNED", "ALL"] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${scope === s ? "#6366f1" : "var(--border)"}`, background: scope === s ? "rgba(99,102,241,0.1)" : "var(--bg-elevated)", color: scope === s ? "#6366f1" : "var(--text-secondary)" }}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Action bar */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>{selected.size} selected</span>
            <ArrowRight size={14} color="var(--text-muted)" />
            <select value={assignCaId} onChange={(e) => setAssignCaId(e.target.value)} style={selectStyle}>
              <option value="">Select CA…</option>
              {cas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={doAssign} disabled={busy} style={{ ...primaryBtn, opacity: busy || selected.size === 0 ? 0.6 : 1 }}>Assign selected</button>
          </div>

          {filtered.length === 0 ? (
            <Empty icon={<Users size={42} color="var(--text-muted)" />} title="No customers here" />
          ) : (
            <div className="section-card" style={{ padding: 0, overflow: "auto" }}>
              <table className="data-table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                    <th>Customer</th>
                    <th>Business</th>
                    <th>Current CA</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} onClick={() => toggle(c.id)} style={{ cursor: "pointer", background: selected.has(c.id) ? "rgba(99,102,241,0.06)" : undefined }}>
                      <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()} /></td>
                      <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{c.company ?? "—"}</td>
                      <td>
                        {c.assignedCaName ? <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{c.assignedCaName}</span> : <span style={{ fontSize: 12, color: "#f59e0b" }}>Unassigned</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Reassign tab */}
      {tab === "reassign" && (
        <div className="section-card" style={{ maxWidth: 560 }}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 18 }}>
            Move every customer from one CA to another in one step.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>From CA</span>
              <select value={fromCaId} onChange={(e) => setFromCaId(e.target.value)} style={selectStyle}>
                <option value="">Select source CA…</option>
                {cas.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.customerCount})</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>To CA</span>
              <select value={toCaId} onChange={(e) => setToCaId(e.target.value)} style={selectStyle}>
                <option value="">Select target CA…</option>
                {cas.filter((c) => c.id !== fromCaId).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.customerCount})</option>)}
              </select>
            </label>
            {fromCaId && (
              <div style={{ padding: "12px 14px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                This will move <strong>{fromCount}</strong> customer{fromCount !== 1 ? "s" : ""}.
              </div>
            )}
            <button onClick={doReassign} disabled={busy || !fromCaId || !toCaId} style={{ ...primaryBtn, justifyContent: "center", opacity: busy || !fromCaId || !toCaId ? 0.6 : 1 }}>
              <Shuffle size={15} /> Move customers
            </button>
          </div>
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        history.length === 0 ? (
          <Empty icon={<History size={42} color="var(--text-muted)" />} title="No assignment history yet" />
        ) : (
          <div className="section-card" style={{ padding: 0, overflow: "auto" }}>
            <table className="data-table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>CA</th>
                  <th>Assigned By</th>
                  <th>State</th>
                  <th>Assigned</th>
                  <th>Ended</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{h.customerName}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{h.caName}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{h.assignedByName ?? "—"}</td>
                    <td>
                      {h.isActive ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#10b981" }}><CheckCircle2 size={13} /> Active</span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)" }}><Clock size={13} /> Ended</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmt(h.assignedAt)}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{h.unassignedAt ? fmt(h.unassignedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function Empty({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="section-card">
      <div className="empty-state">
        {icon}
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</p>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "9px 12px",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 13,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 16px",
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
