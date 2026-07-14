"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionCard } from "@/components/ui/section-card";

interface KycRow {
  id: string;
  organizationId: string;
  status: string;
  orgIdentityVerified: boolean;
  primaryBankVerified: boolean;
  signatoryVerified: boolean;
  documentsComplete: boolean;
  submittedAt: string | null;
  organization: { id: string; name: string; slug: string };
}

const FILTERS = ["", "SUBMITTED", "VERIFICATION_PENDING", "KYC_PENDING", "APPROVED", "REJECTED"];

export default function AdminKycPage() {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter ? `/api/admin/kyc?status=${filter}` : "/api/admin/kyc";
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.data);
      setCounts(data.counts);
    } catch {
      toast.error("Failed to load KYC queue");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function decide(orgId: string, decision: "APPROVE" | "REJECT") {
    const reason = decision === "REJECT" ? window.prompt("Rejection reason:") : undefined;
    if (decision === "REJECT" && !reason) return;

    setActing(orgId);
    try {
      const res = await fetch(`/api/admin/kyc/${orgId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(decision === "APPROVE" ? "KYC approved — workspace unlocked" : "KYC rejected");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>KYC Review Queue</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Module 7 — approve or reject organization KYC submissions</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Awaiting Approval", value: counts.KYC_PENDING ?? 0, icon: <Clock size={18} />, color: "#8b5cf6" },
          { label: "Approved", value: counts.APPROVED ?? 0, icon: <CheckCircle2 size={18} />, color: "#10b981" },
          { label: "Verification Pending", value: counts.VERIFICATION_PENDING ?? 0, icon: <ShieldCheck size={18} />, color: "#f59e0b" },
          { label: "Rejected", value: counts.REJECTED ?? 0, icon: <XCircle size={18} />, color: "#ef4444" },
        ].map((m) => (
          <div key={m.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${m.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: m.color, marginBottom: 12 }}>
              {m.icon}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{m.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f || "ALL"}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: filter === f ? "#6366f1" : "var(--bg-elevated)",
              color: filter === f ? "white" : "var(--text-secondary)",
              border: `1px solid ${filter === f ? "#6366f1" : "var(--border)"}`,
            }}
          >
            {f || "All"}
          </button>
        ))}
      </div>

      <SectionCard title="Submissions" icon={<ShieldCheck size={16} />}>
        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No submissions in this filter</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Organization", "Status", "Identity", "Bank", "Signatory", "Documents", "Submitted", "Actions"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{r.organization.name}</td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={r.status} /></td>
                  {[r.orgIdentityVerified, r.primaryBankVerified, r.signatoryVerified, r.documentsComplete].map((v, i) => (
                    <td key={i} style={{ padding: "10px 12px" }}>
                      {v ? <CheckCircle2 size={14} color="#10b981" /> : <XCircle size={14} color="var(--text-muted)" />}
                    </td>
                  ))}
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.status === "KYC_PENDING" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => decide(r.organizationId, "APPROVE")}
                          disabled={acting === r.organizationId}
                          style={{ padding: "5px 10px", background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => decide(r.organizationId, "REJECT")}
                          disabled={acting === r.organizationId}
                          style={{ padding: "5px 10px", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
