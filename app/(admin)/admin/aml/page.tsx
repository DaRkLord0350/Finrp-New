"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui/section-card";

interface SyncStatus {
  source: string;
  entryCount: number;
  lastSync: { status: string; startedAt: string; errorMessage: string | null } | null;
}

export default function AdminAmlPage() {
  const [status, setStatus] = useState<SyncStatus[] | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const load = () => {
    fetch("/api/admin/aml/watchlist-sync")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setStatus(d.status))
      .catch(() => toast.error("Failed to load watchlist sync status"));
  };

  useEffect(load, []);

  const trigger = async (source: string) => {
    setSyncing(source);
    try {
      const res = await fetch("/api/admin/aml/watchlist-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${source}: ${data.ingested} record(s) ingested`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldAlert size={22} /> AML — Sanctions Watchlist
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Platform-wide reference data — one sync serves every organization</p>
      </div>

      <SectionCard title="OFAC SDN / UN Consolidated List">
        {!status ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {status.map((s) => (
              <div key={s.source} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600 }}>{s.source.replace(/_/g, " ")}</h3>
                  <button onClick={() => trigger(s.source)} disabled={syncing === s.source} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", fontSize: 11, fontWeight: 600, background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                    <RefreshCw size={12} /> {syncing === s.source ? "Syncing…" : "Sync Now"}
                  </button>
                </div>
                <p style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>{s.entryCount.toLocaleString("en-IN")}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {s.lastSync ? `Last: ${s.lastSync.status} · ${new Date(s.lastSync.startedAt).toLocaleString("en-IN")}` : "Never synced"}
                </p>
                {s.lastSync?.errorMessage && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{s.lastSync.errorMessage}</p>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
