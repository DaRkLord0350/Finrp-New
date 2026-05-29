"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  Activity,
  X,
  Copy,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  description: string;
  ipAddress: string | null;
  createdAt: string;
  user: { name: string | null; email: string; avatarUrl: string | null } | null;
}

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface SecurityData {
  auditLogs: AuditLog[];
  total: number;
  page: number;
  pages: number;
  apiTokens: ApiToken[];
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "#10b981",
  UPDATE: "#3b82f6",
  DELETE: "#ef4444",
  LOGIN: "#6366f1",
  EXPORT: "#f59e0b",
  SETTINGS_CHANGE: "#8b5cf6",
};

export default function SecurityPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewToken, setShowNewToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenExpiry, setNewTokenExpiry] = useState("30");
  const [creatingToken, setCreatingToken] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData(page = 1) {
    try {
      const res = await fetch(`/api/settings/security?page=${page}`);
      const d = await res.json();
      setData(d);
    } catch {
      toast.error("Failed to load security data");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateToken() {
    if (!newTokenName.trim()) return toast.error("Token name is required");
    try {
      setCreatingToken(true);
      const res = await fetch("/api/settings/api-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTokenName.trim(),
          expiresInDays: newTokenExpiry ? parseInt(newTokenExpiry) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      const token = await res.json();
      setRevealedToken(token.token);
      setNewTokenName("");
      setNewTokenExpiry("30");
      await fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create token");
    } finally {
      setCreatingToken(false);
    }
  }

  async function handleRevokeToken(tokenId: string) {
    if (!confirm("Revoke this API token? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/settings/api-tokens?id=${tokenId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Token revoked");
      fetchData();
    } catch {
      toast.error("Failed to revoke token");
    }
  }

  function handleCopyToken() {
    if (!revealedToken) return;
    navigator.clipboard.writeText(revealedToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  }

  if (loading) return <PageSkeleton />;

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          Security Settings
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Monitor account activity, manage API tokens, and review security events
        </p>
      </motion.div>

      {/* Token revealed banner */}
      <AnimatePresence>
        {revealedToken && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              background: "#10b98115",
              border: "1px solid #10b98130",
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <CheckCircle size={18} color="#10b981" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#10b981", marginBottom: 4 }}>
                Token created — copy it now. It won't be shown again.
              </p>
              <code
                style={{
                  fontSize: 12,
                  fontFamily: "monospace",
                  color: "var(--text-primary)",
                  background: "var(--bg-elevated)",
                  padding: "4px 8px",
                  borderRadius: 6,
                  wordBreak: "break-all",
                }}
              >
                {revealedToken}
              </code>
            </div>
            <button
              onClick={handleCopyToken}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                background: copiedToken ? "#10b98125" : "#6366f1",
                color: copiedToken ? "#10b981" : "white",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {copiedToken ? <CheckCircle size={13} /> : <Copy size={13} />}
              {copiedToken ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => setRevealedToken(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Tokens */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Key size={15} color="#6366f1" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              API Tokens
            </h2>
            <span
              style={{
                fontSize: 11,
                background: "var(--bg-elevated)",
                color: "var(--text-muted)",
                padding: "2px 8px",
                borderRadius: 20,
              }}
            >
              {data?.apiTokens.length ?? 0} active
            </span>
          </div>
          <button
            onClick={() => setShowNewToken(!showNewToken)}
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
            <Plus size={13} />
            New Token
          </button>
        </div>

        {/* Create Token Form */}
        <AnimatePresence>
          {showNewToken && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                overflow: "hidden",
                padding: "20px 24px",
                background: "var(--bg-elevated)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Token Name *
                  </label>
                  <input
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="e.g. Production API, CI/CD Pipeline"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      background: "var(--bg-base)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                      color: "var(--text-primary)",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ width: 140 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    Expires In
                  </label>
                  <select
                    value={newTokenExpiry}
                    onChange={(e) => setNewTokenExpiry(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      background: "var(--bg-base)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                      color: "var(--text-primary)",
                      outline: "none",
                    }}
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                    <option value="">Never</option>
                  </select>
                </div>
                <button
                  onClick={handleCreateToken}
                  disabled={creatingToken}
                  style={{
                    padding: "9px 18px",
                    background: creatingToken ? "var(--bg-overlay)" : "#6366f1",
                    color: creatingToken ? "var(--text-muted)" : "white",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: creatingToken ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {creatingToken ? "Creating…" : "Create Token"}
                </button>
                <button
                  onClick={() => setShowNewToken(false)}
                  style={{
                    padding: "9px 14px",
                    background: "var(--bg-overlay)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Token List */}
        {data?.apiTokens.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <Key size={32} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              No API tokens yet. Create one to enable programmatic access.
            </p>
          </div>
        ) : (
          data?.apiTokens.map((token) => (
            <div
              key={token.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 24px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "#6366f115",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Key size={15} color="#6366f1" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{token.name}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <code
                    style={{
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "var(--text-muted)",
                      background: "var(--bg-elevated)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {visibleTokens[token.id] ? token.tokenPrefix + "••••••••••" : "••••••••••••"}
                  </code>
                  <button
                    onClick={() => setVisibleTokens((v) => ({ ...v, [token.id]: !v[token.id] }))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
                  >
                    {visibleTokens[token.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
              {token.lastUsedAt && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
                  <p>Last used</p>
                  <p style={{ color: "var(--text-secondary)" }}>
                    {new Date(token.lastUsedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              )}
              {token.expiresAt && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
                  <p>Expires</p>
                  <p
                    style={{
                      color: new Date(token.expiresAt) < new Date() ? "#ef4444" : "var(--text-secondary)",
                    }}
                  >
                    {new Date(token.expiresAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              )}
              <button
                onClick={() => handleRevokeToken(token.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  background: "#ef444415",
                  color: "#ef4444",
                  border: "1px solid #ef444430",
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={12} />
                Revoke
              </button>
            </div>
          ))
        )}
      </motion.div>

      {/* Activity Log */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={15} color="#10b981" />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            Account Activity
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
            {data?.total ?? 0} total events
          </span>
        </div>

        {data?.auditLogs.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <AlertCircle size={32} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No activity recorded yet</p>
          </div>
        ) : (
          <>
            {data?.auditLogs.map((log, idx) => (
              <div
                key={log.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 24px",
                  borderBottom:
                    idx < (data?.auditLogs.length ?? 0) - 1
                      ? "1px solid var(--border)"
                      : "none",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: ACTION_COLORS[log.action] ?? "#6366f1",
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: `${ACTION_COLORS[log.action] ?? "#6366f1"}15`,
                        color: ACTION_COLORS[log.action] ?? "#6366f1",
                      }}
                    >
                      {log.action}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{log.entity}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{log.description}</p>
                  {log.user && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      by {log.user.name || log.user.email}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)", fontSize: 12 }}>
                    <Clock size={11} />
                    {new Date(log.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {log.ipAddress && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {log.ipAddress}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {(data?.pages ?? 1) > 1 && (
              <div
                style={{
                  padding: "12px 24px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {Array.from({ length: data?.pages ?? 1 }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => fetchData(p)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: p === data?.page ? "#6366f1" : "var(--bg-elevated)",
                      color: p === data?.page ? "white" : "var(--text-secondary)",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: p === data?.page ? 600 : 400,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div style={{ padding: 32 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 200, background: "var(--bg-elevated)", borderRadius: 14, marginBottom: 20, animation: "pulse 2s infinite" }} />
      ))}
    </div>
  );
}
