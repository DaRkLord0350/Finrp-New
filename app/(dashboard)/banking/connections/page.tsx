"use client";

import { Plug2, CheckCircle2, XCircle, RefreshCw, Settings, ExternalLink, Wifi, WifiOff, Clock, Zap, Shield, Database } from "lucide-react";

const CONNECTIONS = [
  { id: "setu", name: "Setu Account Aggregator", description: "RBI-licensed AA framework for real-time bank data with consent", logo: "S", status: "CONNECTED", accounts: 3, lastSync: "2 mins ago", category: "AA", tier: "PRIMARY", healthScore: 98, features: ["Real-time sync", "Recurring consent", "All major banks", "Historical data"] },
  { id: "finbox", name: "FinBox BankConnect", description: "Open banking platform with 250+ bank integrations", logo: "F", status: "CONNECTED", accounts: 2, lastSync: "5 mins ago", category: "AA", tier: "PRIMARY", healthScore: 95, features: ["Net banking credentials", "PDF parsing", "Bank statements"] },
  { id: "icici", name: "ICICI Corporate Banking API", description: "Direct ICICI Bank API for real-time balance and transaction data", logo: "IC", status: "DISCONNECTED", accounts: 0, lastSync: null, category: "DIRECT_API", tier: "SECONDARY", healthScore: 0, features: ["Real-time balance", "Instant notifications", "Account validation"] },
  { id: "hdfc", name: "HDFC NetBanking API", description: "HDFC Bank direct integration for corporate accounts", logo: "HD", status: "DISCONNECTED", accounts: 0, lastSync: null, category: "DIRECT_API", tier: "SECONDARY", healthScore: 0, features: ["Transaction history", "FD/RD data", "Loan accounts"] },
  { id: "sbi", name: "SBI YONO Business API", description: "State Bank of India digital banking API integration", logo: "SB", status: "ERROR", accounts: 1, lastSync: "3 days ago", category: "DIRECT_API", tier: "SECONDARY", healthScore: 45, features: ["Balance inquiry", "Statement download"] },
  { id: "axis", name: "Axis Bank API Banking", description: "Axis Bank business banking API with webhook support", logo: "AX", status: "CONNECTED", accounts: 1, lastSync: "15 mins ago", category: "DIRECT_API", tier: "SECONDARY", healthScore: 88, features: ["Real-time webhooks", "Payment APIs"] },
  { id: "pdf", name: "PDF Statement Upload", description: "Upload PDF bank statements with automatic parsing and data extraction", logo: "PD", status: "ACTIVE", accounts: null, lastSync: null, category: "FALLBACK", tier: "FALLBACK", healthScore: null, features: ["All banks", "Password-protected", "Auto data extraction"] },
  { id: "csv", name: "CSV / Excel Import", description: "Import transactions from CSV or Excel files with smart column mapping", logo: "CS", status: "ACTIVE", accounts: null, lastSync: null, category: "FALLBACK", tier: "FALLBACK", healthScore: null, features: ["Custom templates", "Auto mapping", "Duplicate detection"] },
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  CONNECTED:    { bg: "rgba(16,185,129,0.1)",  text: "#10b981", dot: "#10b981", label: "Connected" },
  DISCONNECTED: { bg: "rgba(100,116,139,0.1)", text: "#64748b", dot: "#64748b", label: "Not Connected" },
  ERROR:        { bg: "rgba(239,68,68,0.1)",   text: "#ef4444", dot: "#ef4444", label: "Error" },
  ACTIVE:       { bg: "rgba(99,102,241,0.1)",  text: "#818cf8", dot: "#818cf8", label: "Active" },
  SYNCING:      { bg: "rgba(245,158,11,0.1)",  text: "#f59e0b", dot: "#f59e0b", label: "Syncing" },
};

const TIER_CONFIG: Record<string, { color: string; label: string }> = {
  PRIMARY:    { color: "#10b981", label: "Primary" },
  SECONDARY:  { color: "#6366f1", label: "Direct API" },
  FALLBACK:   { color: "#64748b", label: "Fallback" },
};

export default function BankConnectionsPage() {
  const connected = CONNECTIONS.filter(c => c.status === "CONNECTED" || c.status === "ACTIVE");
  const byCategory = {
    AA: CONNECTIONS.filter(c => c.category === "AA"),
    DIRECT_API: CONNECTIONS.filter(c => c.category === "DIRECT_API"),
    FALLBACK: CONNECTIONS.filter(c => c.category === "FALLBACK"),
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Bank Connections</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Connect your bank accounts through AA, APIs, or file imports</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          ["Active Connections", connected.length, "#10b981"],
          ["Total Banks", CONNECTIONS.filter(c => c.category !== "FALLBACK").length, "#6366f1"],
          ["Connected Accounts", CONNECTIONS.reduce((s, c) => s + (c.accounts ?? 0), 0), "#f59e0b"],
        ].map(([label, value, color]) => (
          <div key={String(label)} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: String(color) }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Connection Groups */}
      {[
        { key: "AA", title: "Account Aggregator (Recommended)", desc: "RBI-regulated AA framework — most secure and compliant" },
        { key: "DIRECT_API", title: "Direct Bank APIs", desc: "Bank-specific API integrations for enhanced features" },
        { key: "FALLBACK", title: "Manual Import", desc: "PDF / CSV / Excel fallback when API connections aren't available" },
      ].map((group) => (
        <div key={group.key}>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{group.title}</h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{group.desc}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {byCategory[group.key as keyof typeof byCategory].map((conn) => {
              const s = STATUS_CONFIG[conn.status] ?? STATUS_CONFIG.DISCONNECTED;
              const tier = TIER_CONFIG[conn.tier] ?? TIER_CONFIG.SECONDARY;
              return (
                <div key={conn.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#6366f1", flexShrink: 0 }}>
                      {conn.logo}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{conn.name}</p>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: `${tier.color}15`, color: tier.color }}>{tier.label}</span>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4, marginTop: 2 }}>{conn.description}</p>
                    </div>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: s.bg, color: s.text, flexShrink: 0 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
                      {s.label}
                    </span>
                  </div>

                  {/* Features */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {conn.features.map(f => (
                      <span key={f} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{f}</span>
                    ))}
                  </div>

                  {/* Health Bar (if connected) */}
                  {conn.healthScore !== null && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Connection health</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: conn.healthScore >= 80 ? "#10b981" : conn.healthScore >= 50 ? "#f59e0b" : "#ef4444" }}>{conn.healthScore}/100</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 4, background: "var(--border)" }}>
                        <div style={{ height: 4, borderRadius: 4, background: conn.healthScore >= 80 ? "#10b981" : conn.healthScore >= 50 ? "#f59e0b" : "#ef4444", width: `${conn.healthScore}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  {conn.lastSync && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={10} color="var(--text-muted)" />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Last sync: {conn.lastSync}</span>
                      {conn.accounts !== null && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{conn.accounts} account{conn.accounts !== 1 ? "s" : ""} linked</span>}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {conn.status === "CONNECTED" || conn.status === "ACTIVE" ? (
                      <>
                        <button style={{ padding: "7px 0", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <RefreshCw size={11} /> Sync Now
                        </button>
                        <button style={{ padding: "7px 0", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <Settings size={11} /> Configure
                        </button>
                      </>
                    ) : conn.status === "ERROR" ? (
                      <>
                        <button style={{ padding: "7px 0", borderRadius: 7, border: "none", background: "#f59e0b", fontSize: 12, color: "white", cursor: "pointer", fontWeight: 600 }}>Reconnect</button>
                        <button style={{ padding: "7px 0", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>View Logs</button>
                      </>
                    ) : (
                      <button style={{ gridColumn: "span 2", padding: "7px 0", borderRadius: 7, border: "none", background: "#6366f1", fontSize: 12, color: "white", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <Plug2 size={12} /> Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
