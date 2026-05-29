"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  Database,
  FileSpreadsheet,
  BookOpen,
  Zap,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Integration {
  id: string;
  type: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  syncIntervalMins: number;
}

interface ImportJob {
  id: string;
  type: string;
  entity: string;
  status: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  completedAt: string | null;
}

interface ImportsData {
  integrations: Integration[];
  recentImports: ImportJob[];
}

const CONNECTOR_META: Record<string, { label: string; icon: React.ComponentType<{size: number; color?: string}>; color: string; description: string }> = {
  ZOHO_BOOKS: { label: "Zoho Books", icon: BookOpen, color: "#e04343", description: "Sync invoices, customers, transactions" },
  ZOHO_CRM: { label: "Zoho CRM", icon: Database, color: "#e04343", description: "Sync leads and customer data" },
  ZOHO_INVENTORY: { label: "Zoho Inventory", icon: BarChart3, color: "#e04343", description: "Sync products and stock levels" },
  TALLY: { label: "Tally", icon: FileSpreadsheet, color: "#1e4799", description: "Import Tally XML exports" },
  ODOO: { label: "Odoo", icon: Zap, color: "#714b67", description: "Sync from Odoo ERP" },
  CSV: { label: "CSV / Excel", icon: FileSpreadsheet, color: "#10b981", description: "Upload flat file data" },
  EXCEL: { label: "Excel", icon: FileSpreadsheet, color: "#1d6f42", description: "Upload Excel spreadsheets" },
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ComponentType<{size: number}> }> = {
  ACTIVE: { label: "Connected", color: "#10b981", icon: CheckCircle },
  INACTIVE: { label: "Not Connected", color: "#6b7280", icon: XCircle },
  ERROR: { label: "Error", color: "#ef4444", icon: AlertTriangle },
  PENDING: { label: "Pending", color: "#f59e0b", icon: Clock },
  COMPLETED: { label: "Completed", color: "#10b981", icon: CheckCircle },
  FAILED: { label: "Failed", color: "#ef4444", icon: XCircle },
  PROCESSING: { label: "Processing", color: "#3b82f6", icon: RefreshCw },
};

function timeSince(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ImportsPage() {
  const [data, setData] = useState<ImportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [intRes, impRes] = await Promise.all([
        fetch("/api/integrations"),
        fetch("/api/imports"),
      ]);
      const [integrations, importsData] = await Promise.all([
        intRes.json(),
        impRes.json(),
      ]);
      setData({
        integrations: Array.isArray(integrations) ? integrations : [],
        recentImports: Array.isArray(importsData) ? importsData.slice(0, 10) : [],
      });
    } catch {
      setData({ integrations: [], recentImports: [] });
    } finally {
      setLoading(false);
    }
  }

  async function handleSync(integrationId: string, integrationType: string) {
    try {
      setSyncing(integrationId);
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, action: "sync", entity: "all" }),
      });
      if (!res.ok) throw new Error("Failed to trigger sync");
      toast.success(`${CONNECTOR_META[integrationType]?.label ?? integrationType} sync started`);
      setTimeout(fetchData, 2000);
    } catch {
      toast.error("Failed to trigger sync");
    } finally {
      setSyncing(null);
    }
  }

  if (loading) return <PageSkeleton />;

  const connectedIntegrations = data?.integrations.filter((i) => i.status === "ACTIVE") ?? [];
  const disconnectedIntegrations = data?.integrations.filter((i) => i.status !== "ACTIVE") ?? [];

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              Import & Migration Center
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Connect integrations, sync data, and manage file imports
            </p>
          </div>
          <Link
            href="/imports/new"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              background: "#6366f1",
              color: "white",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Upload size={14} />
            New Import
          </Link>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}
      >
        {[
          { label: "Connected Sources", value: connectedIntegrations.length, color: "#10b981", icon: <CheckCircle size={18} /> },
          { label: "Total Imports", value: data?.recentImports.length ?? 0, color: "#6366f1", icon: <Upload size={18} /> },
          {
            label: "Records Imported",
            value: data?.recentImports.reduce((s, j) => s + j.successRows, 0) ?? 0,
            color: "#3b82f6",
            icon: <Database size={18} />,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: `${stat.color}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: stat.color,
              }}
            >
              {stat.icon}
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>
                {stat.value.toLocaleString()}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Connected Integrations */}
      {connectedIntegrations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              <CheckCircle size={15} color="#10b981" style={{ marginRight: 8, verticalAlign: "middle" }} />
              Connected Sources
            </h2>
          </div>
          {connectedIntegrations.map((integration) => {
            const meta = CONNECTOR_META[integration.type];
            const Icon = meta?.icon ?? Database;
            const isSyncing = syncing === integration.id;
            const syncStatus = integration.lastSyncStatus ? STATUS_META[integration.lastSyncStatus] : null;

            return (
              <div
                key={integration.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 24px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: `${meta?.color ?? "#6366f1"}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} color={meta?.color ?? "#6366f1"} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                      {meta?.label ?? integration.name}
                    </p>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: "#10b98115",
                        color: "#10b981",
                        fontWeight: 600,
                      }}
                    >
                      Connected
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {meta?.description}
                    {integration.lastSyncAt && ` · Last synced ${timeSince(integration.lastSyncAt)}`}
                  </p>
                  {integration.lastSyncError && (
                    <p style={{ fontSize: 11, color: "#ef4444", marginTop: 2 }}>
                      {integration.lastSyncError}
                    </p>
                  )}
                </div>

                {syncStatus && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: syncStatus.color }}>
                    <syncStatus.icon size={12} />
                    {syncStatus.label}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleSync(integration.id, integration.type)}
                    disabled={!!isSyncing}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      background: "#6366f115",
                      color: "#6366f1",
                      border: "1px solid #6366f130",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isSyncing ? "not-allowed" : "pointer",
                    }}
                  >
                    <RefreshCw size={13} style={{ animation: isSyncing ? "spin 1s linear infinite" : "none" }} />
                    {isSyncing ? "Syncing…" : "Sync Now"}
                  </button>
                  <Link
                    href="/integrations"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "8px 10px",
                      background: "var(--bg-elevated)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      textDecoration: "none",
                    }}
                  >
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Available Integrations */}
      {disconnectedIntegrations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Available Integrations
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 0 }}>
            {disconnectedIntegrations.map((integration) => {
              const meta = CONNECTOR_META[integration.type];
              const Icon = meta?.icon ?? Database;
              return (
                <div
                  key={integration.id}
                  style={{
                    padding: "16px 24px",
                    borderBottom: "1px solid var(--border)",
                    borderRight: "1px solid var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 8,
                        background: `${meta?.color ?? "#6b7280"}15`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={18} color={meta?.color ?? "#6b7280"} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        {meta?.label ?? integration.name}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Not connected</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{meta?.description}</p>
                  <Link
                    href="/integrations"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px",
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Connect <ArrowRight size={11} />
                  </Link>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recent Imports */}
      {(data?.recentImports.length ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            overflow: "hidden",
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
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Recent Imports
            </h2>
            <Link
              href="/imports"
              style={{ fontSize: 13, color: "#6366f1", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  {["File", "Type", "Records", "Status", "Date"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "10px 20px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.recentImports.map((job) => {
                  const statusMeta = STATUS_META[job.status] ?? STATUS_META.PENDING;
                  const StatusIcon = statusMeta.icon;
                  return (
                    <tr key={job.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 20px", color: "var(--text-primary)", fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <FileSpreadsheet size={14} color="var(--text-muted)" />
                          <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {job.fileName}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 20px", color: "var(--text-muted)" }}>
                        {job.entity} · {job.type}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span style={{ color: "#10b981" }}>{job.successRows}</span>
                        <span style={{ color: "var(--text-muted)" }}>/</span>
                        <span style={{ color: "var(--text-secondary)" }}>{job.totalRows}</span>
                        {job.failedRows > 0 && (
                          <span style={{ color: "#ef4444", marginLeft: 4 }}>({job.failedRows} failed)</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 20,
                            color: statusMeta.color,
                            background: `${statusMeta.color}15`,
                          }}
                        >
                          <StatusIcon size={10} />
                          {statusMeta.label}
                        </span>
                      </td>
                      <td style={{ padding: "12px 20px", color: "var(--text-muted)" }}>
                        {timeSince(job.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {(data?.integrations.length === 0) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            textAlign: "center",
            padding: "60px 32px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
          }}
        >
          <Upload size={48} color="var(--text-muted)" style={{ margin: "0 auto 16px" }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            No integrations yet
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>
            Connect Zoho, Tally, or upload CSV files to import your business data
          </p>
          <Link
            href="/integrations"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              background: "#6366f1",
              color: "white",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Set Up Integrations <ArrowRight size={14} />
          </Link>
        </motion.div>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div style={{ padding: 32 }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ height: 120, background: "var(--bg-elevated)", borderRadius: 14, marginBottom: 16, animation: "pulse 2s infinite" }} />
      ))}
    </div>
  );
}
