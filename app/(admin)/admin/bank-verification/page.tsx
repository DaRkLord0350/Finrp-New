"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Landmark } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionCard } from "@/components/ui/section-card";

interface VerificationRow {
  id: string;
  verificationMethod: string;
  verificationStatus: string;
  verifiedAccountHolderName: string | null;
  nameMatchScore: number | null;
  createdAt: string;
  organization: { id: string; name: string };
  bankAccount: { accountName: string; bankName: string; maskedNumber: string | null };
}

export default function AdminBankVerificationPage() {
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bank-verification");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.data);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load bank verification queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 32, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Bank Verification Queue</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Module 6 — TBX penny-drop / penniless BAV results</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <SectionCard title={`Verifications (${total})`} icon={<Landmark size={16} />}>
        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No bank verifications yet</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Organization", "Bank Account", "Method", "Status", "Matched Name", "Score", "Date"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{v.organization.name}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>{v.bankAccount.bankName} · {v.bankAccount.maskedNumber ?? v.bankAccount.accountName}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>{v.verificationMethod}</td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={v.verificationStatus} /></td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>{v.verifiedAccountHolderName ?? "—"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>{v.nameMatchScore ?? "—"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>{new Date(v.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
