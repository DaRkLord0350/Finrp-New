"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plug,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Zap,
  Shield,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Integration {
  id: string;
  provider: string;
  clientId: string;
  apiEndpoint: string | null;
  status: string;
  lastSyncAt: string | null;
  syncFrequencyMins: number;
  webhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2; bg: string; border: string }> = {
  ACTIVE:   { label: "Connected",       color: "#10b981", icon: CheckCircle2, bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)"  },
  INACTIVE: { label: "Not Connected",   color: "#6b7280", icon: Clock,        bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.3)" },
  ERROR:    { label: "Connection Error", color: "#ef4444", icon: AlertCircle,  bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)"   },
  PENDING:  { label: "Pending Test",    color: "#f59e0b", icon: Clock,        bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)"  },
};

function Skeleton({ height = 20 }: { height?: number }) {
  return (
    <div style={{ height, background: "var(--bg-elevated)", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

export default function TredsIntegrationPage() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const [form, setForm] = useState({
    clientId: "",
    clientSecret: "",
    apiEndpoint: "https://api.m1xchange.com/v1",
    syncFrequencyMins: "60",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function loadIntegration() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/treds/integration");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setIntegration(data.integration);
      if (data.integration) {
        setForm((prev) => ({
          ...prev,
          clientId: data.integration.clientId,
          apiEndpoint: data.integration.apiEndpoint ?? prev.apiEndpoint,
          syncFrequencyMins: String(data.integration.syncFrequencyMins),
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadIntegration(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId || !form.clientSecret) {
      toast.error("Client ID and Client Secret are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/treds/integration/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.clientId,
          clientSecret: form.clientSecret,
          apiEndpoint: form.apiEndpoint,
          syncFrequencyMins: parseInt(form.syncFrequencyMins),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      toast.success("Credentials saved. Test the connection to activate.");
      setForm((prev) => ({ ...prev, clientSecret: "" }));
      loadIntegration();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/treds/integration/test", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        loadIntegration();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Connection test failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/treds/integration/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        loadIntegration();
      } else {
        toast.error(data.error ?? "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect M1xchange? This will remove all integration credentials.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/treds/integration", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success("M1xchange integration disconnected.");
      setIntegration(null);
      setForm({ clientId: "", clientSecret: "", apiEndpoint: "https://api.m1xchange.com/v1", syncFrequencyMins: "60" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  const statusCfg = integration ? (STATUS_CONFIG[integration.status] ?? STATUS_CONFIG.INACTIVE) : STATUS_CONFIG.INACTIVE;
  const StatusIcon = statusCfg.icon;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          M1xchange Integration
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
          Connect your M1xchange account to enable TReDS invoice discounting.
        </p>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#ef4444", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {/* Status Card */}
      <motion.div
        className="surface"
        style={{ padding: 20, marginBottom: 20 }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton height={24} />
            <Skeleton height={16} />
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: statusCfg.bg,
                  border: `1px solid ${statusCfg.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <StatusIcon size={22} color={statusCfg.color} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                    M1xchange
                  </p>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: statusCfg.bg,
                      color: statusCfg.color,
                      border: `1px solid ${statusCfg.border}`,
                    }}
                  >
                    {statusCfg.label}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                  {integration
                    ? `Provider: ${integration.provider} · Last sync: ${integration.lastSyncAt ? format(new Date(integration.lastSyncAt), "dd MMM yyyy, HH:mm") : "Never"}`
                    : "Connect your M1xchange account to get started"}
                </p>
              </div>
            </div>

            {integration?.status === "ACTIVE" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-ghost"
                  onClick={handleTest}
                  disabled={testing}
                  style={{ padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
                >
                  <Activity size={13} />
                  {testing ? "Testing..." : "Test Connection"}
                </button>
                <button
                  className="btn-ghost"
                  onClick={handleSync}
                  disabled={syncing}
                  style={{ padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
                >
                  <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* Credentials Form */}
        <motion.div
          className="surface"
          style={{ padding: 24 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Shield size={15} color="#818cf8" />
            <h3 className="section-title" style={{ fontSize: 16 }}>API Credentials</h3>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
            Credentials are encrypted at rest. The client secret is never displayed after saving.
            To update credentials, enter new values and save.
          </p>

          <form onSubmit={handleSave}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="label">Client ID *</label>
                <input
                  className="input"
                  required
                  placeholder="m1x_client_XXXXXXXXXX"
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                />
              </div>

              <div>
                <label className="label">
                  Client Secret * {integration && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(leave blank to keep existing)</span>}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showSecret ? "text" : "password"}
                    style={{ paddingRight: 40 }}
                    placeholder={integration ? "••••••••••••••••" : "Enter client secret"}
                    value={form.clientSecret}
                    onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                    required={!integration}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                  >
                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">API Endpoint</label>
                <input
                  className="input"
                  placeholder="https://api.m1xchange.com/v1"
                  value={form.apiEndpoint}
                  onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Sync Frequency (minutes)</label>
                <select
                  className="input"
                  value={form.syncFrequencyMins}
                  onChange={(e) => setForm({ ...form, syncFrequencyMins: e.target.value })}
                  style={{ appearance: "none", cursor: "pointer" }}
                >
                  <option value="15">Every 15 minutes</option>
                  <option value="30">Every 30 minutes</option>
                  <option value="60">Every hour</option>
                  <option value="120">Every 2 hours</option>
                  <option value="360">Every 6 hours</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button
                  type="submit"
                  className="btn-brand"
                  disabled={saving}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Save size={13} />
                  {saving ? "Saving..." : integration ? "Update Credentials" : "Connect Account"}
                </button>

                {integration && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleTest}
                    disabled={testing}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px" }}
                  >
                    <Zap size={13} />
                    {testing ? "Testing..." : "Test"}
                  </button>
                )}
              </div>
            </div>
          </form>
        </motion.div>

        {/* Info Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Connection details */}
          {integration && (
            <motion.div
              className="surface"
              style={{ padding: 20 }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Plug size={14} color="var(--text-muted)" />
                <h3 className="section-title" style={{ fontSize: 14 }}>Connection Details</h3>
              </div>
              {[
                { label: "Provider", value: integration.provider },
                { label: "Client ID", value: <span style={{ fontFamily: "monospace", fontSize: 12 }}>{integration.clientId}</span> },
                { label: "Status", value: <span style={{ color: statusCfg.color, fontWeight: 600 }}>{statusCfg.label}</span> },
                { label: "Last Sync", value: integration.lastSyncAt ? format(new Date(integration.lastSyncAt), "dd MMM yyyy, HH:mm") : "Never" },
                { label: "Sync Interval", value: `${integration.syncFrequencyMins} min` },
                { label: "Connected", value: format(new Date(integration.createdAt), "dd MMM yyyy") },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
                  <span style={{ fontSize: 12, color: "var(--text-primary)", textAlign: "right", maxWidth: "55%" }}>{value}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Info card */}
          <motion.div
            style={{
              padding: 18,
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.2)",
              borderRadius: 12,
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
          >
            <p style={{ fontSize: 12, fontWeight: 600, color: "#818cf8", marginBottom: 10 }}>About TReDS</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
              TReDS (Trade Receivables Discounting System) is an RBI-regulated platform enabling MSMEs to discount trade receivables at competitive rates.
              M1xchange is one of the three RBI-approved TReDS platforms.
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Your API credentials are available in your M1xchange merchant dashboard under Settings → API Access.
            </p>
          </motion.div>

          {/* Danger zone */}
          {integration && (
            <motion.div
              style={{
                padding: 16,
                background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 12,
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", marginBottom: 8 }}>Danger Zone</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                Disconnecting will remove your API credentials. Your existing TReDS invoice data will be preserved.
              </p>
              <button
                className="btn-ghost"
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{
                  width: "100%",
                  padding: "7px 12px",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  color: "#ef4444",
                  borderColor: "rgba(239,68,68,0.3)",
                }}
              >
                <Trash2 size={13} />
                {disconnecting ? "Disconnecting..." : "Disconnect M1xchange"}
              </button>
            </motion.div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
