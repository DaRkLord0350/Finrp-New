"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionCard } from "@/components/ui/section-card";

interface DocRow {
  id: string;
  documentType: string;
  displayName: string;
  status: string;
  uploadedAt: string;
  organization: { id: string; name: string };
}

export default function AdminDocumentsPage() {
  const [rows, setRows] = useState<DocRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/documents");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.data);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load document queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 32, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Document Review Queue</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Module 3 — organization documents awaiting manual verification</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <SectionCard title={`Pending Review (${total})`} icon={<FileText size={16} />}>
        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Nothing pending review</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Organization", "Document", "Type", "Status", "Uploaded"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{d.organization.name}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)" }}>{d.displayName}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>{d.documentType}</td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={d.status} /></td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>{new Date(d.uploadedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
