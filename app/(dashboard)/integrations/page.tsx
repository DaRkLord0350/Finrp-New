"use client";

// ============================================================
// /integrations — Premium Integration Marketplace
// ============================================================

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  AlertCircle,
  ArrowRight,
  Zap,
  FileSpreadsheet,
  Filter,
  Plug,
  Sparkles,
  Shield,
  Globe,
  BarChart3,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectedIntegration {
  id: string;
  type: string;
  status: string;
  name: string;
  lastSyncAt: string | null;
}

interface ConnectorDef {
  id: string;
  type: string;
  name: string;
  description: string;
  category: string;
  href: string;
  iconColor: string;
  iconBg: string;
  gradient: string;
  initials: string;
  features: string[];
  badge?: string;
}

// ---------------------------------------------------------------------------
// Connector catalog
// ---------------------------------------------------------------------------

const CATEGORIES = ["All", "CRM", "Accounting", "ERP", "Compliance", "Finance", "Data"];

const CONNECTOR_CATALOG: ConnectorDef[] = [
  {
    id: "zoho-crm",
    type: "ZOHO_CRM",
    name: "Zoho CRM",
    description: "Sync contacts, leads, deals, and accounts from Zoho CRM bidirectionally",
    category: "CRM",
    href: "/integrations/zoho",
    iconColor: "#e05a00",
    iconBg: "#e05a0018",
    gradient: "linear-gradient(135deg, #ff6b35, #e05a00)",
    initials: "ZC",
    features: ["Contacts", "Leads", "Deals", "Accounts"],
    badge: "Popular",
  },
  {
    id: "zoho-books",
    type: "ZOHO_BOOKS",
    name: "Zoho Books",
    description: "Import invoices, bills, payments, and expenses from Zoho Books",
    category: "Accounting",
    href: "/integrations/zoho",
    iconColor: "#0f9d58",
    iconBg: "#0f9d5818",
    gradient: "linear-gradient(135deg, #14b86a, #0f9d58)",
    initials: "ZB",
    features: ["Invoices", "Bills", "Payments", "Expenses"],
  },
  {
    id: "zoho-inventory",
    type: "ZOHO_INVENTORY",
    name: "Zoho Inventory",
    description: "Sync products, stock levels, and purchase orders from Zoho Inventory",
    category: "ERP",
    href: "/integrations/zoho",
    iconColor: "#6c4dd6",
    iconBg: "#6c4dd618",
    gradient: "linear-gradient(135deg, #8b6cf7, #6c4dd6)",
    initials: "ZI",
    features: ["Products", "Stock", "Purchase Orders", "Warehouses"],
  },
  {
    id: "tally",
    type: "TALLY",
    name: "Tally Prime",
    description: "Connect Tally ERP for ledger, voucher, inventory, and financial data sync",
    category: "Accounting",
    href: "/integrations/tally",
    iconColor: "#1c6b1c",
    iconBg: "#1c6b1c18",
    gradient: "linear-gradient(135deg, #2da44e, #1c6b1c)",
    initials: "TP",
    features: ["Ledger", "Vouchers", "Inventory", "GST Reports"],
    badge: "Popular",
  },
  {
    id: "odoo",
    type: "ODOO",
    name: "Odoo",
    description: "Sync partners, invoices, and products from Odoo ERP instances seamlessly",
    category: "ERP",
    href: "/integrations/odoo",
    iconColor: "#714b67",
    iconBg: "#714b6718",
    gradient: "linear-gradient(135deg, #9c6b8e, #714b67)",
    initials: "OD",
    features: ["Partners", "Invoices", "Products", "Projects"],
  },
  {
    id: "quickbooks",
    type: "QUICKBOOKS",
    name: "QuickBooks",
    description: "Import customers, invoices, and financial data from QuickBooks Online",
    category: "Accounting",
    href: "/integrations/quickbooks",
    iconColor: "#2ca01c",
    iconBg: "#2ca01c18",
    gradient: "linear-gradient(135deg, #3ecf22, #2ca01c)",
    initials: "QB",
    features: ["Customers", "Invoices", "Expenses", "Reports"],
  },
  {
    id: "sap",
    type: "SAP",
    name: "SAP Business One",
    description: "Connect SAP B1 for enterprise-grade ERP data sync and advanced reporting",
    category: "ERP",
    href: "/integrations/sap",
    iconColor: "#0070f3",
    iconBg: "#0070f318",
    gradient: "linear-gradient(135deg, #3291ff, #0070f3)",
    initials: "SB",
    features: ["Business Partners", "Orders", "Inventory", "Financials"],
    badge: "Enterprise",
  },
  {
    id: "dynamics",
    type: "DYNAMICS",
    name: "Microsoft Dynamics",
    description: "Integrate with Microsoft Dynamics 365 for seamless business data flow",
    category: "ERP",
    href: "/integrations/dynamics",
    iconColor: "#0078d4",
    iconBg: "#0078d418",
    gradient: "linear-gradient(135deg, #2b88d8, #0078d4)",
    initials: "MD",
    features: ["CRM", "Finance", "Supply Chain", "Operations"],
    badge: "Enterprise",
  },
  {
    id: "csv",
    type: "CSV",
    name: "CSV Import",
    description: "Bulk import any data using pre-built CSV templates with automatic validation",
    category: "Data",
    href: "/integrations/csv",
    iconColor: "#06b6d4",
    iconBg: "#06b6d418",
    gradient: "linear-gradient(135deg, #22d3ee, #06b6d4)",
    initials: "CS",
    features: ["Customers", "Vendors", "Invoices", "Products"],
    badge: "Free",
  },
  {
    id: "excel",
    type: "EXCEL",
    name: "Excel Import",
    description: "Import Excel (.xlsx) files directly with automatic column detection and mapping",
    category: "Data",
    href: "/integrations/csv",
    iconColor: "#217346",
    iconBg: "#21734618",
    gradient: "linear-gradient(135deg, #2e7d32, #217346)",
    initials: "EX",
    features: ["Multiple Sheets", "Auto-detect", "Validation", "Mapping"],
    badge: "Free",
  },
  {
    id: "gstn",
    type: "GSTN",
    name: "GST Network",
    description: "Fetch GSTIN verification, returns data, and compliance status directly",
    category: "Compliance",
    href: "/integrations/gstn",
    iconColor: "#f59e0b",
    iconBg: "#f59e0b18",
    gradient: "linear-gradient(135deg, #fbbf24, #f59e0b)",
    initials: "GN",
    features: ["GSTIN Verify", "Returns", "E-Way Bill", "Compliance"],
  },
  {
    id: "mca",
    type: "MCA",
    name: "MCA Portal",
    description: "Verify company details, directors, and filing status from MCA21 Portal",
    category: "Compliance",
    href: "/integrations/mca",
    iconColor: "#8b5cf6",
    iconBg: "#8b5cf618",
    gradient: "linear-gradient(135deg, #a78bfa, #8b5cf6)",
    initials: "MC",
    features: ["Company Search", "Directors", "Filings", "Charges"],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_ICON: Record<string, React.FC<{ size?: number; className?: string }>> = {
  ACTIVE: CheckCircle2,
  SYNCING: RefreshCw,
  EXPIRED: AlertCircle,
  ERROR: AlertCircle,
  PENDING_AUTH: Clock,
  INACTIVE: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#10b981",
  SYNCING: "#3b82f6",
  EXPIRED: "#f59e0b",
  ERROR: "#ef4444",
  PENDING_AUTH: "#f59e0b",
  INACTIVE: "#6b7280",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Connected",
  SYNCING: "Syncing",
  EXPIRED: "Token Expired",
  ERROR: "Error",
  PENDING_AUTH: "Auth Pending",
  INACTIVE: "Inactive",
};

// ---------------------------------------------------------------------------
// Integration card
// ---------------------------------------------------------------------------

function IntegrationCard({
  connector,
  connected,
}: {
  connector: ConnectorDef;
  connected?: ConnectedIntegration;
}) {
  const [hovered, setHovered] = useState(false);
  const isConnected = !!connected;
  const StatusIcon = connected ? (STATUS_ICON[connected.status] ?? XCircle) : null;
  const statusColor = connected ? (STATUS_COLOR[connected.status] ?? "#6b7280") : "#6b7280";
  const statusLabel = connected ? (STATUS_LABEL[connected.status] ?? "Unknown") : "Not Connected";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `radial-gradient(ellipse at top left, ${connector.iconBg}, var(--bg-surface))`
          : "var(--bg-surface)",
        border: `1px solid ${hovered ? connector.iconColor + "40" : "var(--border)"}`,
        borderRadius: 16,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered
          ? `0 12px 40px ${connector.iconColor}20, 0 4px 16px rgba(0,0,0,0.15)`
          : "0 1px 4px rgba(0,0,0,0.08)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Shimmer line on hover */}
      {hovered && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: 2,
          background: connector.gradient,
          borderRadius: "16px 16px 0 0",
        }} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        {/* Logo */}
        <div style={{
          width: 46, height: 46,
          borderRadius: 12,
          background: connector.gradient,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          boxShadow: `0 4px 12px ${connector.iconColor}40`,
        }}>
          <span style={{
            fontSize: 14, fontWeight: 800, color: "white",
            letterSpacing: "0.02em",
          }}>
            {connector.initials}
          </span>
        </div>

        {/* Status + category badges */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flex: 1 }}>
          {/* Connected status */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 10, fontWeight: 600, padding: "3px 8px",
            borderRadius: 20,
            color: statusColor,
            background: `${statusColor}15`,
            border: `1px solid ${statusColor}30`,
            whiteSpace: "nowrap",
          }}>
            {StatusIcon && <StatusIcon size={9} className={connected?.status === "SYNCING" ? "animate-spin" : undefined} />}
            {!StatusIcon && <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, display: "inline-block" }} />}
            {statusLabel}
          </span>

          {/* Category badge */}
          <span style={{
            fontSize: 9, fontWeight: 600, padding: "2px 7px",
            borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em",
            background: "var(--bg-elevated)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}>
            {connector.category}
          </span>
        </div>
      </div>

      {/* Name + badge */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
            {connector.name}
          </h3>
          {connector.badge && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 6px",
              borderRadius: 4,
              background: connector.badge === "Popular" ? "#3b82f615" :
                           connector.badge === "Enterprise" ? "#8b5cf615" :
                           connector.badge === "Free" ? "#10b98115" : "#6b728015",
              color: connector.badge === "Popular" ? "#3b82f6" :
                     connector.badge === "Enterprise" ? "#8b5cf6" :
                     connector.badge === "Free" ? "#10b981" : "#6b7280",
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>
              {connector.badge}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>
          {connector.description}
        </p>
      </div>

      {/* Feature chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {connector.features.map((f) => (
          <span key={f} style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 5,
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            fontWeight: 500,
          }}>
            {f}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 10,
        borderTop: "1px solid var(--border)",
        marginTop: 2,
      }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {connected?.lastSyncAt
            ? `Synced ${timeAgo(connected.lastSyncAt)}`
            : isConnected ? "Never synced" : "Not connected"}
        </span>

        <Link href={connector.href} style={{ textDecoration: "none" }}>
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600,
            padding: "6px 14px",
            borderRadius: 8,
            cursor: "pointer",
            transition: "all 0.15s",
            border: isConnected ? `1px solid ${statusColor}40` : "none",
            background: isConnected
              ? `${statusColor}10`
              : `linear-gradient(135deg, #3b82f6, #06b6d4)`,
            color: isConnected ? statusColor : "white",
            boxShadow: isConnected ? "none" : "0 2px 8px #3b82f630",
          }}>
            {isConnected ? (
              <>
                <Zap size={11} />
                Manage
              </>
            ) : (
              <>
                Connect
                <ArrowRight size={11} />
              </>
            )}
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [connected, setConnected] = useState<ConnectedIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setConnected(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const connectedMap = useMemo(
    () => new Map(connected.map((c) => [c.type, c])),
    [connected]
  );

  const filtered = useMemo(() => {
    return CONNECTOR_CATALOG.filter((c) => {
      const matchSearch = !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === "All" || c.category === category;
      const isConn = connectedMap.has(c.type);
      const matchStatus =
        statusFilter === "All" ||
        (statusFilter === "Connected" && isConn) ||
        (statusFilter === "Not Connected" && !isConn);
      return matchSearch && matchCategory && matchStatus;
    });
  }, [search, category, statusFilter, connectedMap]);

  const connectedCount = CONNECTOR_CATALOG.filter((c) => connectedMap.has(c.type)).length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>

      {/* ── Hero Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 32 }}
      >
        {/* Glassmorphism banner */}
        <div style={{
          background: "linear-gradient(135deg, #3b82f610, #06b6d408)",
          border: "1px solid #3b82f620",
          borderRadius: 20,
          padding: "28px 32px",
          marginBottom: 24,
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Background orbs */}
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 200, height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, #3b82f610, transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: -30, left: 100,
            width: 150, height: 150,
            borderRadius: "50%",
            background: "radial-gradient(circle, #06b6d408, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 24, flexWrap: "wrap",
            position: "relative", zIndex: 1,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 12px #3b82f640",
                }}>
                  <Plug size={18} color="white" />
                </div>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                    Integrations
                  </h1>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                    Connect external systems and sync data automatically.
                  </p>
                </div>
              </div>

              {/* Stats pills */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                {[
                  { icon: Globe, label: `${CONNECTOR_CATALOG.length} Connectors`, color: "#3b82f6" },
                  { icon: CheckCircle2, label: `${connectedCount} Connected`, color: "#10b981" },
                  { icon: Shield, label: "OAuth 2.0 Secure", color: "#8b5cf6" },
                  { icon: BarChart3, label: "Real-time Sync", color: "#f59e0b" },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 12px", borderRadius: 20,
                    background: `${color}12`, border: `1px solid ${color}25`,
                    fontSize: 11, fontWeight: 600, color,
                  }}>
                    <Icon size={11} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: CTA */}
            <Link href="/integrations/csv" style={{ textDecoration: "none", flexShrink: 0 }}>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "11px 20px",
                background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                color: "white", borderRadius: 12,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: "none",
                boxShadow: "0 4px 16px #3b82f640",
                transition: "opacity 0.15s",
              }}>
                <FileSpreadsheet size={15} />
                CSV Import Center
              </button>
            </Link>
          </div>
        </div>

        {/* ── Search + Filters ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{
            position: "relative",
            flex: "1 1 240px",
            minWidth: 200, maxWidth: 320,
          }}>
            <Search size={14} color="var(--text-muted)" style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            }} />
            <input
              type="text"
              placeholder="Search integrations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px 9px 34px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 13, color: "var(--text-primary)",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>

          {/* Category chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Filter size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border: category === cat ? "1px solid #3b82f640" : "1px solid var(--border)",
                  background: category === cat ? "linear-gradient(135deg, #3b82f620, #06b6d415)" : "var(--bg-surface)",
                  color: category === cat ? "#3b82f6" : "var(--text-secondary)",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
            {["All", "Connected", "Not Connected"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 11, fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border: statusFilter === s ? "1px solid #10b98140" : "1px solid var(--border)",
                  background: statusFilter === s
                    ? s === "Connected" ? "#10b98115" : s === "Not Connected" ? "#6b728012" : "#3b82f615"
                    : "var(--bg-surface)",
                  color: statusFilter === s
                    ? s === "Connected" ? "#10b981" : s === "Not Connected" ? "#6b7280" : "#3b82f6"
                    : "var(--text-muted)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Grid ── */}
      <AnimatePresence mode="sync">
        {loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 18,
          }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 16, padding: 20,
                height: 220,
              }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--bg-elevated)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 14, width: "60%", background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ height: 10, width: "40%", background: "var(--bg-elevated)", borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ height: 10, background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 6 }} />
                <div style={{ height: 10, width: "80%", background: "var(--bg-elevated)", borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: "center", padding: "80px 32px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 20,
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: "var(--bg-elevated)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <Search size={28} color="var(--text-muted)" style={{ opacity: 0.4 }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              No integrations found
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Try adjusting your search or filters
            </p>
            <button
              onClick={() => { setSearch(""); setCategory("All"); setStatusFilter("All"); }}
              style={{
                padding: "9px 18px", borderRadius: 10,
                background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                color: "white", border: "none",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Clear Filters
            </button>
          </motion.div>
        ) : (
          <div
            key="grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 18,
            }}
          >
            {filtered.map((connector, i) => (
              <motion.div
                key={connector.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <IntegrationCard
                  connector={connector}
                  connected={connectedMap.get(connector.type)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* ── Footer info ── */}
      {!loading && filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            marginTop: 40, padding: "20px 24px",
            background: "linear-gradient(135deg, #3b82f610, #06b6d408)",
            border: "1px solid #3b82f620",
            borderRadius: 16,
            display: "flex", alignItems: "center", gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Sparkles size={16} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              Need a custom integration?
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Use the CSV Import Center to bulk-import data from any source. Supports Excel, CSV, and more.
            </p>
          </div>
          <Link href="/integrations/csv" style={{ textDecoration: "none", marginLeft: "auto" }}>
            <button style={{
              padding: "8px 16px", borderRadius: 8,
              background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
              color: "white", border: "none",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 2px 8px #3b82f630",
            }}>
              <FileSpreadsheet size={13} />
              Open CSV Import
            </button>
          </Link>
        </motion.div>
      )}

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .int-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .int-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
