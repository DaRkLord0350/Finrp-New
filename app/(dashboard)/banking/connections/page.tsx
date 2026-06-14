"use client";

import { Plug2, CheckCircle2, XCircle, RefreshCw, Zap, Database, Loader2 } from "lucide-react";
import { useQuery } from "@/lib/queryCache";
import { useBankSync } from "@/hooks/useBankSync";

interface BankConnectionRecord {
  id: string;
  provider: string;
  displayName: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR" | "SYNCING" | "PENDING_AUTH";
  lastSyncAt: string | null;
  healthScore: number | null;
  _count: { bankAccounts: number };
}

const PROVIDER_META: Record<string, { name: string; description: string; category: "AA" | "DIRECT" | "FALLBACK"; logo: string }> = {
  SETU_AA:  { name: "Setu Account Aggregator", description: "RBI-licensed AA with real-time bank data", category: "AA", logo: "S" },
  FINBOX:   { name: "FinBox BankConnect", description: "Open banking platform, 250+ bank integrations", category: "AA", logo: "F" },
  ONEMONEY: { name: "OneMoney AA", description: "Account Aggregator for retail banking", category: "AA", logo: "OM" },
  ICICI:    { name: "ICICI Corporate API", description: "Direct ICICI Bank corporate API", category: "DIRECT", logo: "IC" },
  HDFC:     { name: "HDFC NetBanking API", description: "HDFC Bank direct integration", category: "DIRECT", logo: "HD" },
  SBI:      { name: "SBI YONO Business API", description: "State Bank of India digital banking", category: "DIRECT", logo: "SB" },
  AXIS:     { name: "Axis Bank API Banking", description: "Axis Bank business banking with webhooks", category: "DIRECT", logo: "AX" },
  KOTAK:    { name: "Kotak Mahindra API", description: "Kotak Bank corporate banking integration", category: "DIRECT", logo: "KO" },
  MANUAL:   { name: "Manual Entry", description: "Manually entered bank accounts", category: "FALLBACK", logo: "M" },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  CONNECTED:    { bg: "rgba(16,185,129,0.1)",  text: "#10b981", label: "Connected" },
  DISCONNECTED: { bg: "rgba(100,116,139,0.1)", text: "#64748b", label: "Disconnected" },
  ERROR:        { bg: "rgba(239,68,68,0.1)",   text: "#ef4444", label: "Error" },
  SYNCING:      { bg: "rgba(245,158,11,0.1)",  text: "#f59e0b", label: "Syncing" },
  PENDING_AUTH: { bg: "rgba(99,102,241,0.1)",  text: "#818cf8", label: "Pending Auth" },
};

const FALLBACK_METHODS = [
  { id: "pdf", name: "PDF Statement Upload", description: "Upload PDF bank statements with automatic parsing", logo: "PD", features: ["All banks", "Password-protected PDFs", "Auto data extraction"] },
  { id: "csv", name: "CSV / Excel Import", description: "Import transactions via CSV or Excel with smart column mapping", logo: "CS", features: ["Custom templates", "Auto column mapping", "Duplicate detection"] },
];

function formatTimeAgo(d: string | null) {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BankConnectionsPage() {
  const { connectSetu } = useBankSync();

  const { data, isLoading } = useQuery(
    ["banking", "connections"],
    async () => {
      const r = await fetch("/api/banking/connections");
      if (!r.ok) return { connections: [] as BankConnectionRecord[] };
      return r.json() as Promise<{ connections: BankConnectionRecord[] }>;
    },
    { staleTime: 60_000 }
  );

  const connections = data?.connections ?? [];
  const connectedCount = connections.filter(c => c.status === "CONNECTED").length;
  const totalAccounts = connections.reduce((s, c) => s + c._count.bankAccounts, 0);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Bank Connections</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Connect your bank accounts through Account Aggregator, APIs, or file imports</p>
        </div>
        <button onClick={() => connectSetu()} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 14px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer", fontWeight: 600 }}>
          <Plug2 size={12} /> Connect New
        </button>
      </div>

      {/* Stats */}
      {!isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            ["Active Connections", connectedCount, "#10b981"],
            ["Providers Configured", connections.length, "#6366f1"],
            ["Connected Accounts", totalAccounts, "#f59e0b"],
          ].map(([label, value, color]) => (
            <div key={String(label)} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: String(color) }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Active connections from DB */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ height: 84, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.4 }} />)}
        </div>
      ) : connections.length > 0 ? (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Configured Integrations</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {connections.map(conn => {
              const meta = PROVIDER_META[conn.provider] ?? { name: conn.displayName ?? conn.provider, description: "", category: "DIRECT" as const, logo: conn.provider.slice(0, 2) };
              const cfg = STATUS_CONFIG[conn.status] ?? STATUS_CONFIG.DISCONNECTED;
              return (
                <div key={conn.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6366f1", flexShrink: 0 }}>
                    {meta.logo}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{conn.displayName ?? meta.name}</p>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {conn._count.bankAccounts} account{conn._count.bankAccounts !== 1 ? "s" : ""} · Last sync: {formatTimeAgo(conn.lastSyncAt)}
                      {conn.healthScore !== null && ` · Health: ${conn.healthScore}/100`}
                    </p>
                  </div>
                  {conn.status !== "CONNECTED" && (
                    <button onClick={() => connectSetu()} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", color: "#6366f1", cursor: "pointer", fontWeight: 600 }}>
                      Reconnect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 12, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
          <Plug2 size={28} color="var(--text-muted)" />
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No bank connections configured yet.</p>
          <button onClick={() => connectSetu()} style={{ fontSize: 12, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>
            Connect Your First Bank
          </button>
        </div>
      )}

      {/* Fallback Methods */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Fallback / Manual Methods</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {FALLBACK_METHODS.map(m => (
            <div key={m.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(99,102,241,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#818cf8" }}>
                  {m.logo}
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{m.name}</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.description}</p>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {m.features.map(f => (
                  <span key={f} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>{f}</span>
                ))}
              </div>
              <a href="/banking/import" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, marginTop: 10, color: "#6366f1", textDecoration: "none" }}>
                Go to Import <Zap size={10} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
