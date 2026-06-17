"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCheck, UserPlus, RefreshCcw, X, Link2, Unlink } from "lucide-react";

interface CaOption {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  customerId: string;
  active: { id: string; caId: string; caName: string } | null;
  caUsers: CaOption[];
  firmLinked: boolean;
}

export function AssignmentPanel({ customerId, active, caUsers, firmLinked }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [caId, setCaId] = useState(active?.caId ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!caId) return toast.error("Select a CA");
    setBusy(true);
    try {
      const res = active
        ? await fetch(`/api/assignments/${active.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caId, notes }),
          })
        : await fetch("/api/assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId, caId, notes }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(active ? "Customer reassigned" : "CA assigned");
      setEditing(false);
      setNotes("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!active) return;
    if (!confirm("Remove this CA assignment?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assignments/${active.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
      toast.success("Assignment removed");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFirmLink() {
    setBusy(true);
    try {
      const res = await fetch("/api/firms/customers/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, unlink: firmLinked }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed");
      toast.success(firmLinked ? "Unlinked from firm" : "Linked to firm");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13,
    color: "var(--text-primary)",
    outline: "none",
  };

  return (
    <div className="section-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserCheck size={16} color="#0ea5e9" />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Assigned CA</h2>
        </div>
        <button
          onClick={toggleFirmLink}
          disabled={busy}
          title={firmLinked ? "Unlink from firm" : "Link to firm"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 10px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 7,
            cursor: "pointer",
            fontSize: 11.5,
            fontWeight: 600,
            color: firmLinked ? "#ef4444" : "#10b981",
          }}
        >
          {firmLinked ? <Unlink size={13} /> : <Link2 size={13} />}
          {firmLinked ? "Unlink firm" : "Link firm"}
        </button>
      </div>

      {!editing ? (
        <>
          {active ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(14,165,233,0.15)",
                  color: "#0ea5e9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {active.caName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{active.caName}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Currently assigned</p>
              </div>
              <button onClick={() => setEditing(true)} style={iconBtn} title="Reassign">
                <RefreshCcw size={14} />
              </button>
              <button onClick={remove} disabled={busy} style={{ ...iconBtn, color: "#ef4444" }} title="Remove">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No CA assigned yet.</p>
              <button
                onClick={() => setEditing(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  background: "#6366f1",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <UserPlus size={14} /> Assign CA
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <select style={inputStyle} value={caId} onChange={(e) => setCaId(e.target.value)}>
            <option value="">Select CA…</option>
            {caUsers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.email}
              </option>
            ))}
          </select>
          <input
            style={inputStyle}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Assignment note (optional)"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setEditing(false)}
              style={{ flex: 1, padding: "9px", background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              style={{ flex: 2, padding: "9px", background: "#6366f1", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}
            >
              {busy ? "Saving…" : active ? "Reassign" : "Assign"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 7,
  cursor: "pointer",
  color: "var(--text-secondary)",
};
