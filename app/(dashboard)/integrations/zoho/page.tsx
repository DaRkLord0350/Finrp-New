"use client";

// ============================================================
// /integrations/zoho — Premium 5-Step Zoho Setup Wizard
// Step 1: Select Region
// Step 2: Choose Modules
// Step 3: Authorize
// Step 4: Sync Config
// Step 5: Success
// ============================================================

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Globe,
  Shield,
  RefreshCw,
  Zap,
  Database,
  Clock,
  Settings2,
  Users,
  FileText,
  Package,
  Lock,
  ExternalLink,
  Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface DataCenter {
  value: string;
  label: string;
  url: string;
  flag: string;
  region: string;
}

interface ZohoModule {
  type: string;
  label: string;
  description: string;
  icon: React.FC<{ size?: number; color?: string }>;
  color: string;
  features: string[];
}

interface ZohoIntegration {
  id: string;
  type: string;
  status: string;
  name: string;
  lastSyncAt: string | null;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const DATA_CENTERS: DataCenter[] = [
  { value: "IN", label: "India", url: "zoho.in", flag: "🇮🇳", region: "South Asia" },
  { value: "US", label: "United States", url: "zoho.com", flag: "🇺🇸", region: "North America" },
  { value: "EU", label: "Europe", url: "zoho.eu", flag: "🇪🇺", region: "European Union" },
  { value: "AU", label: "Australia", url: "zoho.com.au", flag: "🇦🇺", region: "Oceania" },
];

const ZOHO_MODULES: ZohoModule[] = [
  {
    type: "ZOHO_CRM",
    label: "Zoho CRM",
    description: "Sync leads, contacts, accounts, and deals from your CRM pipeline",
    icon: Users,
    color: "#e05a00",
    features: ["Contacts", "Leads", "Accounts", "Deals", "Activities", "Notes"],
  },
  {
    type: "ZOHO_BOOKS",
    label: "Zoho Books",
    description: "Import invoices, bills, payments, vendor credits, and expense data",
    icon: FileText,
    color: "#0f9d58",
    features: ["Invoices", "Bills", "Payments", "Expenses", "Vendors", "Tax Reports"],
  },
  {
    type: "ZOHO_INVENTORY",
    label: "Zoho Inventory",
    description: "Sync products, warehouses, stock adjustments, and purchase orders",
    icon: Package,
    color: "#6c4dd6",
    features: ["Products", "Stock", "Warehouses", "Purchase Orders", "SKUs", "Bundles"],
  },
];

const SYNC_FREQUENCIES = [
  { value: "realtime", label: "Realtime", description: "Sync immediately on every change", icon: Zap, color: "#06b6d4" },
  { value: "15min", label: "Every 15 Minutes", description: "High-frequency incremental sync", icon: RefreshCw, color: "#3b82f6" },
  { value: "hourly", label: "Hourly", description: "Balanced performance and freshness", icon: Clock, color: "#8b5cf6" },
  { value: "daily", label: "Daily", description: "Low-volume one-time sync at midnight", icon: Database, color: "#6b7280" },
];

const SYNC_DIRECTIONS = [
  { value: "import", label: "Import Only", description: "Pull data from Zoho into FinRP", icon: ArrowRight },
  { value: "export", label: "Export Only", description: "Push data from FinRP into Zoho", icon: ArrowLeft },
  { value: "bidirectional", label: "Bidirectional", description: "Full two-way sync between both systems", icon: RefreshCw },
];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEP_LABELS = ["Select Region", "Choose Modules", "Authorize", "Sync Config", "Complete"];

function StepIndicator({ current }: { current: WizardStep }) {
  return (
    <div style={{ marginBottom: 32 }}>
      {/* Progress bar */}
      <div style={{
        height: 4, background: "var(--bg-elevated)",
        borderRadius: 4, marginBottom: 20, overflow: "hidden",
      }}>
        <motion.div
          animate={{ width: `${((current - 1) / 4) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
            borderRadius: 4,
          }}
        />
      </div>

      {/* Step dots */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as WizardStep;
          const isDone = stepNum < current;
          const isActive = stepNum === current;
          return (
            <div key={label} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              flex: 1,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s",
                background: isDone
                  ? "linear-gradient(135deg, #3b82f6, #06b6d4)"
                  : isActive
                  ? "#3b82f615"
                  : "var(--bg-elevated)",
                border: isActive
                  ? "2px solid #3b82f6"
                  : isDone
                  ? "none"
                  : "2px solid var(--border)",
                boxShadow: isActive ? "0 0 0 4px #3b82f615" : "none",
              }}>
                {isDone ? (
                  <CheckCircle2 size={14} color="white" />
                ) : (
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: isActive ? "#3b82f6" : "var(--text-muted)",
                  }}>
                    {stepNum}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: isActive ? "#3b82f6" : isDone ? "var(--text-secondary)" : "var(--text-muted)",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export default function ZohoIntegrationPage() {
  const searchParams = useSearchParams();
  const isConnected = searchParams.get("connected") === "true";
  const errorParam = searchParams.get("error");

  const [step, setStep] = useState<WizardStep>(1);
  const [dataCenter, setDataCenter] = useState("IN");
  const [selectedModules, setSelectedModules] = useState<string[]>(["ZOHO_CRM"]);
  const [syncFrequency, setSyncFrequency] = useState("hourly");
  const [syncDirection, setSyncDirection] = useState("bidirectional");
  const [isConnecting, setIsConnecting] = useState(false);
  const [existingIntegrations, setExistingIntegrations] = useState<ZohoIntegration[]>([]);

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.ok ? r.json() : [])
      .then((all: ZohoIntegration[]) => {
        if (Array.isArray(all)) {
          setExistingIntegrations(all.filter((i) => i.type.startsWith("ZOHO")));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isConnected) setStep(5);
  }, [isConnected]);

  function toggleModule(type: string) {
    setSelectedModules((prev) =>
      prev.includes(type) ? prev.filter((m) => m !== type) : [...prev, type]
    );
  }

  async function handleConnect() {
    if (selectedModules.length === 0) return;
    setIsConnecting(true);

    // Build ?crm=true&books=true&... from selected module types (ZOHO_CRM → crm)
    const moduleQuery = selectedModules
      .map((m) => `${m.replace("ZOHO_", "").toLowerCase()}=true`)
      .join("&");

    try {
      const moduleType = selectedModules[0];
      const existing = existingIntegrations.find((i) => i.type === moduleType);

      if (existing) {
        window.location.href = `/api/oauth/zoho?integrationId=${existing.id}&dataCenter=${dataCenter}&${moduleQuery}`;
        return;
      }

      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: moduleType,
          name: ZOHO_MODULES.find((m) => m.type === moduleType)?.label ?? moduleType,
          config: { dataCenter, modules: selectedModules, syncFrequency, syncDirection },
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        if (res.status === 409) {
          const all = await fetch("/api/integrations").then((r) => r.json()) as ZohoIntegration[];
          const found = all.find((i: ZohoIntegration) => i.type === moduleType);
          if (found) {
            window.location.href = `/api/oauth/zoho?integrationId=${found.id}&dataCenter=${dataCenter}&${moduleQuery}`;
            return;
          }
        }
        throw new Error(err.error ?? "Failed to create integration");
      }

      const integration = await res.json() as ZohoIntegration;
      window.location.href = `/api/oauth/zoho?integrationId=${integration.id}&dataCenter=${dataCenter}&${moduleQuery}`;
    } catch (err) {
      console.error("Connect failed:", err);
    } finally {
      setIsConnecting(false);
    }
  }

  // Data scopes displayed in Step 3
  const scopesByModule: Record<string, string[]> = {
    ZOHO_CRM: ["Contacts", "Leads", "Accounts", "Deals", "Activities"],
    ZOHO_BOOKS: ["Invoices", "Bills", "Expenses", "Payments", "Vendors"],
    ZOHO_INVENTORY: ["Products", "Stock", "Warehouses", "Purchase Orders"],
  };

  const dataScopes = selectedModules.flatMap((m) => scopesByModule[m] ?? []);

  const slideVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 24px" }}>

      {/* ── Back + Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <Link href="/integrations" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20 }}>
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8,
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
          }}>
            <ArrowLeft size={13} />
            Back to Integrations
          </button>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #ff6b35, #e05a00)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px #e05a0040",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: "white" }}>Z</span>
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
              Zoho Integration
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              Connect Zoho CRM, Books, and Inventory to FinRP
            </p>
          </div>
        </div>

        {/* Success/error banners */}
        {isConnected && (
          <div style={{
            marginTop: 16, padding: "12px 16px",
            background: "#10b98115", border: "1px solid #10b98130",
            borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
          }}>
            <CheckCircle2 size={15} color="#10b981" />
            <p style={{ fontSize: 13, color: "#10b981", fontWeight: 500 }}>
              Successfully connected to Zoho! Your data will sync in the background.
            </p>
          </div>
        )}

        {errorParam && (
          <div style={{
            marginTop: 16, padding: "12px 16px",
            background: "#ef444415", border: "1px solid #ef444430",
            borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertCircle size={15} color="#ef4444" />
            <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 500 }}>
              Connection failed: {decodeURIComponent(errorParam)}
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Wizard card ── */}
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 20,
        padding: "28px 32px",
        minHeight: 520,
      }}>
        <StepIndicator current={step} />

        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════
              STEP 1 — Select Region
          ═══════════════════════════════════════ */}
          {step === 1 && (
            <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                  Select your Zoho Data Center
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Choose the region where your Zoho account is hosted. Indian accounts use zoho.in.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                {DATA_CENTERS.map((dc) => (
                  <button
                    key={dc.value}
                    onClick={() => setDataCenter(dc.value)}
                    style={{
                      padding: "18px 20px",
                      borderRadius: 14,
                      border: dataCenter === dc.value
                        ? "2px solid #3b82f6"
                        : "2px solid var(--border)",
                      background: dataCenter === dc.value
                        ? "linear-gradient(135deg, #3b82f610, #06b6d408)"
                        : "var(--bg-elevated)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                      transform: dataCenter === dc.value ? "scale(1.02)" : "scale(1)",
                      boxShadow: dataCenter === dc.value ? "0 4px 20px #3b82f625" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <span style={{ fontSize: 28 }}>{dc.flag}</span>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                          {dc.label}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{dc.region}</p>
                      </div>
                      {dataCenter === dc.value && (
                        <CheckCircle2 size={16} color="#3b82f6" style={{ marginLeft: "auto" }} />
                      )}
                    </div>
                    <code style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 5,
                      background: dataCenter === dc.value ? "#3b82f615" : "var(--bg-surface)",
                      color: dataCenter === dc.value ? "#3b82f6" : "var(--text-muted)",
                      border: `1px solid ${dataCenter === dc.value ? "#3b82f630" : "var(--border)"}`,
                    }}>
                      {dc.url}
                    </code>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 24px", borderRadius: 10,
                    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                    color: "white", border: "none",
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 14px #3b82f640",
                  }}
                >
                  Continue
                  <ArrowRight size={15} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════
              STEP 2 — Choose Modules
          ═══════════════════════════════════════ */}
          {step === 2 && (
            <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                  Choose Zoho Modules
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Select which Zoho products you want to connect. You can add more later.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {ZOHO_MODULES.map((module) => {
                  const Icon = module.icon;
                  const isSelected = selectedModules.includes(module.type);
                  const isExisting = existingIntegrations.some((i) => i.type === module.type);
                  return (
                    <button
                      key={module.type}
                      onClick={() => toggleModule(module.type)}
                      style={{
                        padding: "18px 20px",
                        borderRadius: 14,
                        border: isSelected ? `2px solid ${module.color}60` : "2px solid var(--border)",
                        background: isSelected
                          ? `linear-gradient(135deg, ${module.color}10, ${module.color}05)`
                          : "var(--bg-elevated)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.2s",
                        boxShadow: isSelected ? `0 4px 16px ${module.color}20` : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                        <div style={{
                          width: 42, height: 42, borderRadius: 11,
                          background: `${module.color}20`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <Icon size={20} color={module.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                              {module.label}
                            </p>
                            {isExisting && (
                              <span style={{
                                fontSize: 10, padding: "2px 7px", borderRadius: 10,
                                background: "#10b98115", color: "#10b981",
                                border: "1px solid #10b98130", fontWeight: 600,
                              }}>
                                Already connected
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                            {module.description}
                          </p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {module.features.map((f) => (
                              <span key={f} style={{
                                fontSize: 10, padding: "2px 7px", borderRadius: 5,
                                background: isSelected ? `${module.color}15` : "var(--bg-surface)",
                                color: isSelected ? module.color : "var(--text-muted)",
                                border: `1px solid ${isSelected ? module.color + "30" : "var(--border)"}`,
                                fontWeight: 500,
                              }}>
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6,
                          border: isSelected ? "none" : "2px solid var(--border)",
                          background: isSelected ? `linear-gradient(135deg, ${module.color}, ${module.color}cc)` : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0, marginTop: 2,
                          transition: "all 0.2s",
                        }}>
                          {isSelected && <CheckCircle2 size={13} color="white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    padding: "10px 18px", borderRadius: 10,
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <ArrowLeft size={13} />
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={selectedModules.length === 0}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 24px", borderRadius: 10,
                    background: selectedModules.length === 0
                      ? "var(--bg-elevated)"
                      : "linear-gradient(135deg, #3b82f6, #06b6d4)",
                    color: selectedModules.length === 0 ? "var(--text-muted)" : "white",
                    border: "none", fontSize: 14, fontWeight: 700, cursor: selectedModules.length === 0 ? "not-allowed" : "pointer",
                    boxShadow: selectedModules.length > 0 ? "0 4px 14px #3b82f640" : "none",
                  }}
                >
                  Continue ({selectedModules.length} selected)
                  <ArrowRight size={15} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════
              STEP 3 — Authorize
          ═══════════════════════════════════════ */}
          {step === 3 && (
            <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                  Authorize with Zoho
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Review the data permissions below, then connect to Zoho via secure OAuth 2.0.
                </p>
              </div>

              {/* OAuth card */}
              <div style={{
                background: "linear-gradient(135deg, #3b82f610, #06b6d408)",
                border: "1px solid #3b82f625",
                borderRadius: 16, padding: "24px",
                marginBottom: 16,
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 12px #3b82f640",
                  }}>
                    <Lock size={20} color="white" />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                      Secure OAuth 2.0 Connection
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      You will be redirected to Zoho to grant access
                    </p>
                  </div>
                </div>

                {/* Data access list */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Data Access Requested
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 7 }}>
                    {dataScopes.map((scope) => (
                      <div key={scope} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", borderRadius: 8,
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border)",
                      }}>
                        <CheckCircle2 size={12} color="#10b981" />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                          {scope}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security notice */}
                <div style={{
                  padding: "12px 14px",
                  background: "#10b98108",
                  border: "1px solid #10b98120",
                  borderRadius: 10,
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}>
                  <Shield size={14} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12, color: "#10b981", lineHeight: 1.55 }}>
                    <strong>Your credentials are never stored.</strong> FinRP uses OAuth 2.0 tokens that are
                    encrypted at rest. You can revoke access from Zoho at any time.
                  </p>
                </div>
              </div>

              {/* Connecting from */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 10,
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                marginBottom: 20,
              }}>
                <Globe size={14} color="var(--text-muted)" />
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Connecting to <strong style={{ color: "var(--text-secondary)" }}>
                    {DATA_CENTERS.find((dc) => dc.value === dataCenter)?.url}
                  </strong> · {DATA_CENTERS.find((dc) => dc.value === dataCenter)?.label}
                </div>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    marginLeft: "auto", fontSize: 11, color: "#3b82f6",
                    background: "none", border: "none", cursor: "pointer", fontWeight: 600,
                  }}
                >
                  Change
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    padding: "10px 18px", borderRadius: 10,
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <ArrowLeft size={13} />
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 24px", borderRadius: 10,
                    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                    color: "white", border: "none",
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 14px #3b82f640",
                  }}
                >
                  <Settings2 size={15} />
                  Configure Sync Settings
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════
              STEP 4 — Sync Configuration
          ═══════════════════════════════════════ */}
          {step === 4 && (
            <motion.div key="step4" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                  Sync Configuration
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Configure how and when data syncs between Zoho and FinRP.
                </p>
              </div>

              {/* Sync Frequency */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
                  Sync Frequency
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {SYNC_FREQUENCIES.map((freq) => {
                    const Icon = freq.icon;
                    const isSelected = syncFrequency === freq.value;
                    return (
                      <button
                        key={freq.value}
                        onClick={() => setSyncFrequency(freq.value)}
                        style={{
                          padding: "14px 16px", borderRadius: 12,
                          border: isSelected ? `2px solid ${freq.color}60` : "2px solid var(--border)",
                          background: isSelected ? `${freq.color}10` : "var(--bg-elevated)",
                          cursor: "pointer", textAlign: "left",
                          transition: "all 0.2s",
                          boxShadow: isSelected ? `0 4px 12px ${freq.color}20` : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                          <Icon size={15} color={isSelected ? freq.color : "var(--text-muted)"} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? freq.color : "var(--text-primary)" }}>
                            {freq.label}
                          </span>
                          {isSelected && <CheckCircle2 size={13} color={freq.color} style={{ marginLeft: "auto" }} />}
                        </div>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {freq.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sync Direction */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
                  Sync Direction
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {SYNC_DIRECTIONS.map((dir) => {
                    const Icon = dir.icon;
                    const isSelected = syncDirection === dir.value;
                    return (
                      <button
                        key={dir.value}
                        onClick={() => setSyncDirection(dir.value)}
                        style={{
                          padding: "14px 18px", borderRadius: 12,
                          border: isSelected ? "2px solid #3b82f650" : "2px solid var(--border)",
                          background: isSelected ? "#3b82f610" : "var(--bg-elevated)",
                          cursor: "pointer", textAlign: "left",
                          display: "flex", alignItems: "center", gap: 14,
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 9,
                          background: isSelected ? "#3b82f620" : "var(--bg-surface)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <Icon size={16} color={isSelected ? "#3b82f6" : "var(--text-muted)"} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "#3b82f6" : "var(--text-primary)" }}>
                            {dir.label}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {dir.description}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 size={15} color="#3b82f6" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button
                  onClick={() => setStep(3)}
                  style={{
                    padding: "10px 18px", borderRadius: 10,
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    fontSize: 13, color: "var(--text-secondary)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <ArrowLeft size={13} />
                  Back
                </button>
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "11px 24px", borderRadius: 10,
                    background: isConnecting ? "var(--bg-elevated)" : "linear-gradient(135deg, #ff6b35, #e05a00)",
                    color: isConnecting ? "var(--text-muted)" : "white",
                    border: "none", fontSize: 14, fontWeight: 700,
                    cursor: isConnecting ? "not-allowed" : "pointer",
                    boxShadow: isConnecting ? "none" : "0 4px 14px #e05a0040",
                  }}
                >
                  {isConnecting ? (
                    <><RefreshCw size={14} className="animate-spin" /> Connecting…</>
                  ) : (
                    <><ExternalLink size={14} /> Connect to Zoho</>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════
              STEP 5 — Success
          ═══════════════════════════════════════ */}
          {step === 5 && (
            <motion.div key="step5" variants={slideVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.25 }}>
              <div style={{ textAlign: "center", paddingTop: 16 }}>
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
                  style={{
                    width: 80, height: 80, borderRadius: 24,
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 20px",
                    boxShadow: "0 8px 32px #10b98140",
                  }}
                >
                  <CheckCircle2 size={40} color="white" />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
                    Connection Successful!
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 28 }}>
                    Zoho has been connected to FinRP. Your data will start syncing shortly.
                  </p>
                </motion.div>

                {/* Summary */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    borderRadius: 16, padding: "20px 24px",
                    textAlign: "left", marginBottom: 24,
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
                    Connection Summary
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "Data Center", value: DATA_CENTERS.find((dc) => dc.value === dataCenter)?.label ?? dataCenter },
                      {
                        label: "Modules Connected",
                        value: selectedModules.map((m) => ZOHO_MODULES.find((zm) => zm.type === m)?.label ?? m).join(", ") || "Zoho CRM",
                      },
                      {
                        label: "Sync Frequency",
                        value: SYNC_FREQUENCIES.find((f) => f.value === syncFrequency)?.label ?? syncFrequency,
                      },
                      {
                        label: "Sync Direction",
                        value: SYNC_DIRECTIONS.find((d) => d.value === syncDirection)?.label ?? syncDirection,
                      },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
                >
                  <button
                    onClick={() => handleConnect()}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "12px 24px", borderRadius: 10,
                      background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                      color: "white", border: "none",
                      fontSize: 14, fontWeight: 700, cursor: "pointer",
                      boxShadow: "0 4px 16px #3b82f640",
                    }}
                  >
                    <Sparkles size={15} />
                    Start First Sync
                  </button>
                  <Link href="/integrations" style={{ textDecoration: "none" }}>
                    <button style={{
                      padding: "12px 24px", borderRadius: 10,
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer",
                    }}>
                      View All Integrations
                    </button>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
