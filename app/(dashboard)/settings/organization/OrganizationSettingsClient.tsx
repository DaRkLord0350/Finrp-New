"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  Save,
  FileText,
  Receipt,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import BranchesSection, { type OrgBranch } from "@/components/settings/organization/BranchesSection";
import DepartmentsSection, { type OrgDepartment } from "@/components/settings/organization/DepartmentsSection";
import RelatedPartiesSection, { type RelatedParty } from "@/components/settings/organization/RelatedPartiesSection";

interface OperationalAddress {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

interface OrgData {
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    createdAt: string;
  };
  profile: {
    businessName?: string;
    businessType?: string;
    registrationNo?: string;
    taxId?: string;
    industry?: string;
    companySize?: string;
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    pincode?: string;
    currency?: string;
    timezone?: string;
    language?: string;
    fiscalYearType?: string;
    logoUrl?: string;
    websiteUrl?: string;
    phone?: string;
    pan?: string;
    cin?: string;
    gstin?: string;
    // TBX Foundation (Phase 1) — Organization Master extensions
    msmeRegistrationNo?: string | null;
    msmeCategory?: string | null;
    operationalAddress?: OperationalAddress | null;
    defaultBankAccountId?: string | null;
    panVerificationStatus?: string | null;
    gstVerificationStatus?: string | null;
    cinVerificationStatus?: string | null;
    tbxCustomerId?: string | null;
    tbxStatus?: string | null;
  } | null;
  settings: {
    defaultTaxRate?: number;
    taxLabel?: string;
    taxRegistered?: boolean;
    invoicePrefix?: string;
    defaultPaymentTerms?: number;
    dateFormat?: string;
    numberFormat?: string;
    inventoryEnabled?: boolean;
    payrollEnabled?: boolean;
    complianceEnabled?: boolean;
    loanModuleEnabled?: boolean;
    multiCurrencyEnabled?: boolean;
  } | null;
  branches: OrgBranch[];
  departments: OrgDepartment[];
  relatedParties: RelatedParty[];
}

interface BankAccountOption {
  id: string;
  accountName: string;
  bankName: string;
  isPrimary: boolean;
}

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];
const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Singapore",
];
const FISCAL_YEARS = [
  { value: "APRIL_MARCH", label: "April – March (India)" },
  { value: "JANUARY_DECEMBER", label: "January – December" },
  { value: "JULY_JUNE", label: "July – June" },
];
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

export default function OrganizationSettingsClient({ initialData }: { initialData: OrgData }) {
  const [data] = useState<OrgData>(initialData);
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState(initialData.org.name);
  const [profile, setProfile] = useState<OrgData["profile"]>(initialData.profile ?? {});
  const [settings, setSettings] = useState<OrgData["settings"]>(initialData.settings ?? {});
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [hasOperationalAddress, setHasOperationalAddress] = useState(
    Boolean(initialData.profile?.operationalAddress)
  );

  useEffect(() => {
    fetch("/api/banking/accounts")
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((d) => setBankAccounts(d.accounts ?? []))
      .catch(() => setBankAccounts([]));
  }, []);

  const updateOperationalAddress = (key: keyof OperationalAddress, value: string) =>
    setProfile((p) => ({ ...p, operationalAddress: { ...(p?.operationalAddress ?? {}), [key]: value } }));

  async function handleSave() {
    if (!orgName.trim()) {
      toast.error("Organization name is required");
      return;
    }
    const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (profile?.gstin && !gstinPattern.test(profile.gstin)) {
      toast.error("Invalid GSTIN format");
      return;
    }
    const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (profile?.pan && !panPattern.test(profile.pan)) {
      toast.error("Invalid PAN format (e.g. ABCDE1234F)");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, profile, settings }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success("Organization settings saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const updateProfile = (key: string, value: unknown) =>
    setProfile((p) => ({ ...p, [key]: value }));
  const updateSettings = (key: string, value: unknown) =>
    setSettings((s) => ({ ...s, [key]: value }));

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 32 }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              Organization Settings
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Manage your company details, financial preferences, and feature flags
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 12px",
                borderRadius: 20,
                background:
                  data?.org.plan === "ENTERPRISE"
                    ? "#6366f120"
                    : data?.org.plan === "GROWTH"
                    ? "#10b98120"
                    : "#f59e0b20",
                color:
                  data?.org.plan === "ENTERPRISE"
                    ? "#818cf8"
                    : data?.org.plan === "GROWTH"
                    ? "#10b981"
                    : "#f59e0b",
                border: `1px solid ${
                  data?.org.plan === "ENTERPRISE"
                    ? "#6366f130"
                    : data?.org.plan === "GROWTH"
                    ? "#10b98130"
                    : "#f59e0b30"
                }`,
              }}
            >
              {data?.org.plan} Plan
            </span>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              ID: {data?.org.id.slice(0, 12)}…
            </p>
          </div>
        </div>
      </motion.div>

      {/* Basic Info */}
      <Section title="Company Information" icon={<Building2 size={16} />} delay={0.05}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Organization Name" required>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Corp"
              style={inputStyle}
            />
          </Field>
          <Field label="Organization ID">
            <input value={data?.org.id ?? ""} disabled style={{ ...inputStyle, color: "var(--text-muted)", cursor: "not-allowed" }} />
          </Field>
          <Field label="Business Name">
            <input
              value={profile?.businessName ?? ""}
              onChange={(e) => updateProfile("businessName", e.target.value)}
              placeholder="Legal business name"
              style={inputStyle}
            />
          </Field>
          <Field label="Business Type">
            <select
              value={profile?.businessType ?? ""}
              onChange={(e) => updateProfile("businessType", e.target.value)}
              style={inputStyle}
            >
              <option value="">Select type</option>
              {["Sole Proprietorship", "Partnership", "LLP", "Private Limited", "Public Limited", "OPC", "Trust", "Society"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Industry">
            <select
              value={profile?.industry ?? ""}
              onChange={(e) => updateProfile("industry", e.target.value)}
              style={inputStyle}
            >
              <option value="">Select industry</option>
              {["Technology", "Manufacturing", "Retail", "Healthcare", "Finance", "Education", "Real Estate", "Consulting", "Hospitality", "Other"].map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </Field>
          <Field label="Company Size">
            <select
              value={profile?.companySize ?? ""}
              onChange={(e) => updateProfile("companySize", e.target.value)}
              style={inputStyle}
            >
              <option value="">Select size</option>
              {["1-10", "11-50", "51-200", "201-500", "500+"].map((s) => (
                <option key={s} value={s}>{s} employees</option>
              ))}
            </select>
          </Field>
          <Field label="Phone">
            <input
              value={profile?.phone ?? ""}
              onChange={(e) => updateProfile("phone", e.target.value)}
              placeholder="+91 98765 43210"
              style={inputStyle}
            />
          </Field>
          <Field label="Website">
            <input
              value={profile?.websiteUrl ?? ""}
              onChange={(e) => updateProfile("websiteUrl", e.target.value)}
              placeholder="https://example.com"
              style={inputStyle}
            />
          </Field>
        </div>
      </Section>

      {/* Tax & Legal */}
      <Section title="Tax & Legal Identifiers" icon={<Receipt size={16} />} delay={0.1}>
        {(profile?.panVerificationStatus || profile?.gstVerificationStatus || profile?.cinVerificationStatus) && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <VerificationBadge label="PAN" status={profile?.panVerificationStatus} />
            <VerificationBadge label="GST" status={profile?.gstVerificationStatus} />
            <VerificationBadge label="CIN" status={profile?.cinVerificationStatus} />
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="GSTIN">
            <input
              value={profile?.gstin ?? ""}
              onChange={(e) => updateProfile("gstin", e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              style={inputStyle}
            />
          </Field>
          <Field label="PAN">
            <input
              value={profile?.pan ?? ""}
              onChange={(e) => updateProfile("pan", e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              maxLength={10}
              style={inputStyle}
            />
          </Field>
          <Field label="CIN">
            <input
              value={profile?.cin ?? ""}
              onChange={(e) => updateProfile("cin", e.target.value.toUpperCase())}
              placeholder="U12345MH2020PTC123456"
              style={inputStyle}
            />
          </Field>
          <Field label="TAN / Registration No">
            <input
              value={profile?.registrationNo ?? ""}
              onChange={(e) => updateProfile("registrationNo", e.target.value)}
              placeholder="ABCD12345E"
              style={inputStyle}
            />
          </Field>
          <Field label="MSME / Udyam Registration No">
            <input
              value={profile?.msmeRegistrationNo ?? ""}
              onChange={(e) => updateProfile("msmeRegistrationNo", e.target.value.toUpperCase())}
              placeholder="UDYAM-XX-00-0000000"
              style={inputStyle}
            />
          </Field>
          <Field label="MSME Category">
            <select
              value={profile?.msmeCategory ?? ""}
              onChange={(e) => updateProfile("msmeCategory", e.target.value || null)}
              style={inputStyle}
            >
              <option value="">Not applicable</option>
              <option value="MICRO">Micro</option>
              <option value="SMALL">Small</option>
              <option value="MEDIUM">Medium</option>
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <ToggleRow
            label="GST Registered"
            description="Enable GST calculations on invoices"
            checked={settings?.taxRegistered ?? false}
            onChange={(v) => updateSettings("taxRegistered", v)}
          />
        </div>
      </Section>

      {/* Address */}
      <Section title="Address" icon={<MapPin size={16} />} delay={0.15}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Registered Address
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Address" style={{ gridColumn: "1 / -1" }}>
            <textarea
              value={profile?.address ?? ""}
              onChange={(e) => updateProfile("address", e.target.value)}
              placeholder="Street address"
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
          <Field label="City">
            <input value={profile?.city ?? ""} onChange={(e) => updateProfile("city", e.target.value)} placeholder="Mumbai" style={inputStyle} />
          </Field>
          <Field label="State">
            <input value={profile?.state ?? ""} onChange={(e) => updateProfile("state", e.target.value)} placeholder="Maharashtra" style={inputStyle} />
          </Field>
          <Field label="Pincode">
            <input value={profile?.pincode ?? ""} onChange={(e) => updateProfile("pincode", e.target.value)} placeholder="400001" style={inputStyle} />
          </Field>
          <Field label="Country">
            <input value={profile?.country ?? ""} onChange={(e) => updateProfile("country", e.target.value)} placeholder="India" style={inputStyle} />
          </Field>
        </div>

        <div style={{ marginTop: 16 }}>
          <ToggleRow
            label="Operational address differs from registered address"
            description="Track a separate correspondence / operating location"
            checked={hasOperationalAddress}
            onChange={(v) => {
              setHasOperationalAddress(v);
              if (!v) updateProfile("operationalAddress", null);
            }}
          />
        </div>
        {hasOperationalAddress && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <Field label="Operational Address" style={{ gridColumn: "1 / -1" }}>
              <textarea
                value={profile?.operationalAddress?.address ?? ""}
                onChange={(e) => updateOperationalAddress("address", e.target.value)}
                placeholder="Street address"
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>
            <Field label="City">
              <input value={profile?.operationalAddress?.city ?? ""} onChange={(e) => updateOperationalAddress("city", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="State">
              <input value={profile?.operationalAddress?.state ?? ""} onChange={(e) => updateOperationalAddress("state", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Pincode">
              <input value={profile?.operationalAddress?.pincode ?? ""} onChange={(e) => updateOperationalAddress("pincode", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Country">
              <input value={profile?.operationalAddress?.country ?? ""} onChange={(e) => updateOperationalAddress("country", e.target.value)} style={inputStyle} />
            </Field>
          </div>
        )}
      </Section>

      {/* Financial Preferences */}
      <Section title="Financial Preferences" icon={<DollarSign size={16} />} delay={0.2}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Currency">
            <select value={profile?.currency ?? "INR"} onChange={(e) => updateProfile("currency", e.target.value)} style={inputStyle}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Fiscal Year">
            <select value={profile?.fiscalYearType ?? "APRIL_MARCH"} onChange={(e) => updateProfile("fiscalYearType", e.target.value)} style={inputStyle}>
              {FISCAL_YEARS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Timezone">
            <select value={profile?.timezone ?? "Asia/Kolkata"} onChange={(e) => updateProfile("timezone", e.target.value)} style={inputStyle}>
              {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Date Format">
            <select value={settings?.dateFormat ?? "DD/MM/YYYY"} onChange={(e) => updateSettings("dateFormat", e.target.value)} style={inputStyle}>
              {DATE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Preferred Bank Account">
            <select
              value={profile?.defaultBankAccountId ?? ""}
              onChange={(e) => updateProfile("defaultBankAccountId", e.target.value || null)}
              style={inputStyle}
            >
              <option value="">No default set</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountName} — {a.bankName}{a.isPrimary ? " (Primary)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default Tax Rate (%)">
            <input
              type="number"
              min="0"
              max="100"
              value={settings?.defaultTaxRate ?? 18}
              onChange={(e) => updateSettings("defaultTaxRate", parseFloat(e.target.value))}
              style={inputStyle}
            />
          </Field>
          <Field label="Tax Label">
            <input
              value={settings?.taxLabel ?? "GST"}
              onChange={(e) => updateSettings("taxLabel", e.target.value)}
              placeholder="GST"
              style={inputStyle}
            />
          </Field>
        </div>
      </Section>

      {/* Invoice */}
      <Section title="Invoice Configuration" icon={<FileText size={16} />} delay={0.25}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Invoice Prefix">
            <input
              value={settings?.invoicePrefix ?? "INV"}
              onChange={(e) => updateSettings("invoicePrefix", e.target.value)}
              placeholder="INV"
              style={inputStyle}
            />
          </Field>
          <Field label="Default Payment Terms (days)">
            <input
              type="number"
              min="0"
              value={settings?.defaultPaymentTerms ?? 30}
              onChange={(e) => updateSettings("defaultPaymentTerms", parseInt(e.target.value))}
              style={inputStyle}
            />
          </Field>
        </div>
      </Section>

      {/* Module Toggles */}
      <Section title="Feature Modules" icon={<Calendar size={16} />} delay={0.3}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { key: "inventoryEnabled", label: "Inventory Management", desc: "Track stock, SKUs, and purchase orders" },
            { key: "payrollEnabled", label: "Payroll", desc: "Process employee salaries and deductions" },
            { key: "complianceEnabled", label: "Compliance Module", desc: "GST filings, TDS, and regulatory submissions" },
            { key: "loanModuleEnabled", label: "Loan Management", desc: "Track business loans and EMI schedules" },
            { key: "multiCurrencyEnabled", label: "Multi-Currency", desc: "Handle invoices in multiple currencies" },
          ].map((mod) => (
            <ToggleRow
              key={mod.key}
              label={mod.label}
              description={mod.desc}
              checked={Boolean(settings?.[mod.key as keyof typeof settings])}
              onChange={(v) => updateSettings(mod.key, v)}
            />
          ))}
        </div>
      </Section>

      <BranchesSection initialBranches={data.branches} />
      <DepartmentsSection initialDepartments={data.departments} />
      <RelatedPartiesSection initialParties={data.relatedParties} />

      {/* Save */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 24px",
            background: saving ? "var(--bg-elevated)" : "#6366f1",
            color: saving ? "var(--text-muted)" : "white",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save All Changes"}
        </button>
      </motion.div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
  color: "var(--text-primary)",
  outline: "none",
  boxSizing: "border-box",
};

function Section({
  title,
  icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 24,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
          color: "var(--text-primary)",
        }}
      >
        <span style={{ color: "#6366f1" }}>{icon}</span>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

function Field({
  label,
  required,
  children,
  style,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-secondary)",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
        {required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        borderRadius: 10,
        border: "1px solid var(--border)",
      }}
    >
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
          {label}
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 42,
          height: 24,
          borderRadius: 12,
          background: checked ? "#6366f1" : "var(--bg-overlay)",
          border: "none",
          cursor: "pointer",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "white",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    </div>
  );
}

const VERIFICATION_STYLES: Record<string, { bg: string; color: string; text: string }> = {
  VERIFIED: { bg: "#10b98120", color: "#10b981", text: "Verified" },
  FAILED: { bg: "#ef444420", color: "#ef4444", text: "Failed" },
  PENDING: { bg: "#f59e0b20", color: "#f59e0b", text: "Pending" },
  IN_PROGRESS: { bg: "#f59e0b20", color: "#f59e0b", text: "In Progress" },
  EXPIRED: { bg: "#6b728020", color: "#6b7280", text: "Expired" },
  NOT_STARTED: { bg: "#6b728020", color: "#6b7280", text: "Not Verified" },
};

function VerificationBadge({ label, status }: { label: string; status?: string | null }) {
  const style = VERIFICATION_STYLES[status ?? "NOT_STARTED"] ?? VERIFICATION_STYLES.NOT_STARTED;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 20,
        background: style.bg,
        color: style.color,
      }}
    >
      <Landmark size={11} />
      {label}: {style.text}
    </span>
  );
}

