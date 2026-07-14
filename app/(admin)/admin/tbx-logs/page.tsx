"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Activity, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui/section-card";

interface LogRow {
  id: string;
  apiName: string;
  endpoint: string | null;
  statusCode: number | null;
  durationMs: number | null;
  retryCount: number;
  success: boolean;
  errorMessage: string | null;
  organizationId: string | null;
  createdAt: string;
}

export default function AdminTbxLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tbx-logs");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRows(data.data);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load TBX call log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 32, maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>TBX API Call Log</h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Module 8 — every outbound TBX verification call, audited</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <SectionCard title={`Recent Calls (${total})`} icon={<Activity size={16} />}>
        {loading ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No TBX calls logged yet</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["API", "Endpoint", "Result", "Status", "Duration", "Retries", "When"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{l.apiName}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{l.endpoint ?? "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {l.success ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#10b981", fontSize: 12 }}><CheckCircle2 size={12} /> Success</span>
                    ) : (
                      <span title={l.errorMessage ?? ""} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#ef4444", fontSize: 12 }}><XCircle size={12} /> Failed</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>{l.statusCode ?? "—"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>{l.durationMs ? `${l.durationMs}ms` : "—"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>{l.retryCount}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-muted)" }}>{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
