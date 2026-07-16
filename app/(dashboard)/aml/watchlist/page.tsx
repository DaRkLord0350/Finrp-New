"use client";

import { useQuery } from "@/lib/queryCache";

interface SyncStatus {
  source: string;
  entryCount: number;
  lastSync: { status: string; startedAt: string; completedAt: string | null; recordsIngested: number; errorMessage: string | null } | null;
}

async function api(url: string) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function AMLWatchlistPage() {
  const { data, isLoading } = useQuery<{ status: SyncStatus[] }>(["aml", "watchlist-sync"], () => api("/api/aml/watchlist/sync-status"));

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Sanctions Watchlist Sync</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        OFAC SDN and UN Consolidated List ingestion — global reference data shared across every organization, refreshed daily.
      </p>

      {isLoading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {data?.status?.map((s) => (
            <div key={s.source} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{s.source.replace(/_/g, " ")}</h3>
              <p style={{ fontSize: 24, fontWeight: 700 }}>{s.entryCount.toLocaleString("en-IN")}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>active watchlist entries</p>
              {s.lastSync ? (
                <div style={{ fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  <p>Last sync: <strong>{s.lastSync.status}</strong></p>
                  <p style={{ color: "var(--text-muted)" }}>{new Date(s.lastSync.startedAt).toLocaleString("en-IN")}</p>
                  {s.lastSync.errorMessage && <p style={{ color: "#ef4444", marginTop: 4 }}>{s.lastSync.errorMessage}</p>}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  Never synced — configure the feed URL and wait for the daily sync, or trigger one from Admin.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
