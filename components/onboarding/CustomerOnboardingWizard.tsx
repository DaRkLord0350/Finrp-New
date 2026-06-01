"use client";

// ============================================================
// CustomerOnboardingWizard — 6-step wizard for CUSTOMER users.
// Steps:
//   1. Business Information
//   2. Address Information
//   3. Financial Setup
//   4. Import Existing Data
//   5. Connect Integrations
//   6. Review & Finish
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Zap,
  Building2,
  MapPin,
  DollarSign,
  Upload,
  Plug,
  CheckCircle2,
} from "lucide-react";
import {
  actionSaveBusinessInfo,
  actionSaveAddressInfo,
  actionSaveFinancialSetup,
  actionSaveCustomerImportChoice,
  actionCompleteCustomerOnboarding,
} from "@/actions/customer-onboarding";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const businessInfoSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format (e.g. ABCDE1234F)")
    .optional()
    .or(z.literal("")),
  gstNumber: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
      "Invalid GSTIN format"
    )
    .optional()
    .or(z.literal("")),
  industry: z.string().min(1, "Please select an industry"),
  businessType: z.string().min(1, "Please select a business type"),
});

const addressSchema = z.object({
  address: z.string().min(5, "Please enter a complete address"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  country: z.string().min(2, "Country is required"),
  pincode: z.string().optional().or(z.literal("")),
});

const financialSchema = z.object({
  currency: z.string().min(1, "Currency is required"),
  fiscalYearStart: z.string().min(1, "Fiscal year start is required"),
  openingBankBalance: z.number().optional(),
  monthlyRevenueEstimate: z.number().optional(),
  monthlyExpenseEstimate: z.number().optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
});

type BusinessInfoInput = z.infer<typeof businessInfoSchema>;
type AddressInput = z.infer<typeof addressSchema>;
type FinancialInput = z.infer<typeof financialSchema>;
type ImportChoice = "ZOHO" | "TALLY" | "CSV" | "SKIP";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------
const STEPS = [
  { id: 1, title: "Business Info", icon: Building2 },
  { id: 2, title: "Address", icon: MapPin },
  { id: 3, title: "Financials", icon: DollarSign },
  { id: 4, title: "Import", icon: Upload },
  { id: 5, title: "Integrations", icon: Plug },
  { id: 6, title: "Finish", icon: CheckCircle2 },
];

const INDUSTRIES = [
  "Technology", "Manufacturing", "Retail / E-commerce", "Healthcare",
  "Financial Services", "Real Estate", "Education", "Hospitality & Tourism",
  "Agriculture", "Logistics & Transport", "Media & Entertainment", "Other",
];

const BUSINESS_TYPES = [
  "Sole Proprietorship", "Partnership", "Limited Liability Partnership (LLP)",
  "Private Limited Company", "Public Limited Company", "One Person Company (OPC)",
  "Non-Profit Organization", "Other",
];

const CURRENCIES = [
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AED", label: "AED — UAE Dirham" },
];

const FISCAL_YEARS = [
  { value: "APRIL_MARCH", label: "April – March (India standard)" },
  { value: "JANUARY_DECEMBER", label: "January – December" },
  { value: "JULY_JUNE", label: "July – June" },
  { value: "OCTOBER_SEPTEMBER", label: "October – September" },
];

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const inputStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--text-primary)",
  padding: "10px 14px",
  fontSize: 14,
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  display: "block",
  letterSpacing: "0.02em",
};

const errorStyle: React.CSSProperties = {
  color: "#ef4444",
  fontSize: 11,
  marginTop: 4,
  display: "block",
};

const navBtnBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "11px 20px",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
  transition: "all 0.2s ease",
};

// ---------------------------------------------------------------------------
// Wizard component
// ---------------------------------------------------------------------------
export function CustomerOnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importChoice, setImportChoice] = useState<ImportChoice>("SKIP");
  const [completedData, setCompletedData] = useState<{
    companyName?: string;
    businessType?: string;
    industry?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    currency?: string;
  }>({});

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  // ── Step 1: Business Info ────────────────────────────────────────────────
  const bizForm = useForm<BusinessInfoInput>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: { companyName: "", pan: "", gstNumber: "", industry: "", businessType: "" },
  });

  async function handleBizNext(data: BusinessInfoInput) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionSaveBusinessInfo({
        companyName: data.companyName,
        pan: data.pan || undefined,
        gstNumber: data.gstNumber || undefined,
        industry: data.industry,
        businessType: data.businessType,
      });
      if (!res.success) throw new Error(res.error);
      setCompletedData((p) => ({ ...p, companyName: data.companyName, businessType: data.businessType, industry: data.industry }));
      setStep(2);
    } catch (e) {
      setError((e as Error).message ?? "Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 2: Address ──────────────────────────────────────────────────────
  const addrForm = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: { address: "", city: "", state: "", country: "India", pincode: "" },
  });

  async function handleAddrNext(data: AddressInput) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionSaveAddressInfo(data);
      if (!res.success) throw new Error(res.error);
      setCompletedData((p) => ({ ...p, address: data.address, city: data.city, state: data.state, country: data.country }));
      setStep(3);
    } catch (e) {
      setError((e as Error).message ?? "Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 3: Financial ────────────────────────────────────────────────────
  const finForm = useForm<FinancialInput>({
    resolver: zodResolver(financialSchema),
    defaultValues: { currency: "INR", fiscalYearStart: "APRIL_MARCH" },
  });

  async function handleFinNext(data: FinancialInput) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionSaveFinancialSetup(data);
      if (!res.success) throw new Error(res.error);
      setCompletedData((p) => ({ ...p, currency: data.currency }));
      setStep(4);
    } catch (e) {
      setError((e as Error).message ?? "Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 4: Import ───────────────────────────────────────────────────────
  async function handleImportNext() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionSaveCustomerImportChoice(importChoice);
      if (!res.success) throw new Error(res.error);
      setStep(5);
    } catch (e) {
      setError((e as Error).message ?? "Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 5: Integrations (info only, skip to review) ─────────────────────
  function handleIntegrationsNext() {
    setStep(6);
  }

  // ── Step 6: Complete ─────────────────────────────────────────────────────
  async function handleComplete() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionCompleteCustomerOnboarding();
      if (!res.success) throw new Error(res.error);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError((e as Error).message ?? "Failed to complete setup.");
      setIsLoading(false);
    }
  }

  const currentStep = STEPS.find((s) => s.id === step) ?? STEPS[0];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px 48px",
      }}
    >
      {/* Glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 600,
          background: "radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ width: "100%", maxWidth: 680, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          <div style={{ width: 34, height: 34, background: "linear-gradient(135deg, #6366f1, #10b981)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} color="white" />
          </div>
          <span style={{ fontSize: 20, fontWeight: 800, background: "linear-gradient(135deg, #818cf8, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>
            FinRP
          </span>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
            {STEPS.map((s, idx) => {
              const isCompleted = s.id < step;
              const isActive = s.id === step;
              const Icon = s.icon;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 52 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, transition: "all 0.2s ease", background: isCompleted ? "linear-gradient(135deg, #10b981, #059669)" : isActive ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "var(--bg-elevated)", border: `1.5px solid ${isCompleted ? "#10b981" : isActive ? "#6366f1" : "var(--border)"}`, color: isCompleted || isActive ? "white" : "var(--text-muted)" }}>
                      {isCompleted ? <Check size={12} strokeWidth={3} /> : <Icon size={12} />}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--text-primary)" : isCompleted ? "var(--accent-500)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {s.title}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, borderRadius: 2, minWidth: 10, background: isCompleted ? "linear-gradient(90deg, #10b981, #6366f1)" : "var(--border)", transition: "background 0.3s" }} />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
            <motion.div
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              style={{ height: "100%", background: "linear-gradient(90deg, #6366f1, #10b981)", borderRadius: 4 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Step {step} of {STEPS.length}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{Math.round(progressPct)}% complete</span>
          </div>
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}
              role="alert"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 20, padding: "36px 40px", boxShadow: "var(--shadow-lg)" }}
          >
            {/* Step header */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-400)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                Customer Setup — Step {step}
              </p>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.025em", lineHeight: 1.2 }}>
                {step === 1 && "Business Information"}
                {step === 2 && "Address Information"}
                {step === 3 && "Financial Setup"}
                {step === 4 && "Import Existing Data"}
                {step === 5 && "Connect Integrations"}
                {step === 6 && "Review & Finish"}
              </h1>
            </div>

            {/* ── Step 1: Business Info ── */}
            {step === 1 && (
              <form onSubmit={bizForm.handleSubmit(handleBizNext)}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Company Name *</label>
                    <input {...bizForm.register("companyName")} placeholder="e.g. Acme Private Limited" style={inputStyle} disabled={isLoading} />
                    {bizForm.formState.errors.companyName && <span style={errorStyle}>{bizForm.formState.errors.companyName.message}</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Business Type *</label>
                      <select {...bizForm.register("businessType")} style={{ ...inputStyle, cursor: "pointer" }} disabled={isLoading}>
                        <option value="">Select type...</option>
                        {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {bizForm.formState.errors.businessType && <span style={errorStyle}>{bizForm.formState.errors.businessType.message}</span>}
                    </div>
                    <div>
                      <label style={labelStyle}>Industry *</label>
                      <select {...bizForm.register("industry")} style={{ ...inputStyle, cursor: "pointer" }} disabled={isLoading}>
                        <option value="">Select industry...</option>
                        {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                      </select>
                      {bizForm.formState.errors.industry && <span style={errorStyle}>{bizForm.formState.errors.industry.message}</span>}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>PAN Number <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
                      <input {...bizForm.register("pan")} placeholder="ABCDE1234F" style={{ ...inputStyle, textTransform: "uppercase" }} disabled={isLoading} />
                      {bizForm.formState.errors.pan && <span style={errorStyle}>{bizForm.formState.errors.pan.message}</span>}
                    </div>
                    <div>
                      <label style={labelStyle}>GST Number <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
                      <input {...bizForm.register("gstNumber")} placeholder="22AAAAA0000A1Z5" style={{ ...inputStyle, textTransform: "uppercase" }} disabled={isLoading} />
                      {bizForm.formState.errors.gstNumber && <span style={errorStyle}>{bizForm.formState.errors.gstNumber.message}</span>}
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading} style={{ ...navBtnBase, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", opacity: isLoading ? 0.75 : 1 }}>
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {isLoading ? "Saving…" : "Continue"}
                    {!isLoading && <ArrowRight size={16} />}
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 2: Address ── */}
            {step === 2 && (
              <form onSubmit={addrForm.handleSubmit(handleAddrNext)}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Street Address *</label>
                    <input {...addrForm.register("address")} placeholder="e.g. 42 MG Road, Koramangala" style={inputStyle} disabled={isLoading} />
                    {addrForm.formState.errors.address && <span style={errorStyle}>{addrForm.formState.errors.address.message}</span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>City *</label>
                      <input {...addrForm.register("city")} placeholder="Bangalore" style={inputStyle} disabled={isLoading} />
                      {addrForm.formState.errors.city && <span style={errorStyle}>{addrForm.formState.errors.city.message}</span>}
                    </div>
                    <div>
                      <label style={labelStyle}>State *</label>
                      <input {...addrForm.register("state")} placeholder="Karnataka" style={inputStyle} disabled={isLoading} />
                      {addrForm.formState.errors.state && <span style={errorStyle}>{addrForm.formState.errors.state.message}</span>}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Country *</label>
                      <input {...addrForm.register("country")} placeholder="India" style={inputStyle} disabled={isLoading} />
                      {addrForm.formState.errors.country && <span style={errorStyle}>{addrForm.formState.errors.country.message}</span>}
                    </div>
                    <div>
                      <label style={labelStyle}>PIN Code <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
                      <input {...addrForm.register("pincode")} placeholder="560001" style={inputStyle} disabled={isLoading} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={() => setStep(1)} disabled={isLoading} style={{ ...navBtnBase, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto", padding: "11px 20px" }}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="submit" disabled={isLoading} style={{ ...navBtnBase, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", flex: 1, opacity: isLoading ? 0.75 : 1 }}>
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                      {isLoading ? "Saving…" : "Continue"} {!isLoading && <ArrowRight size={16} />}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── Step 3: Financial Setup ── */}
            {step === 3 && (
              <form onSubmit={finForm.handleSubmit(handleFinNext)}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Primary Currency *</label>
                      <select {...finForm.register("currency")} style={{ ...inputStyle, cursor: "pointer" }} disabled={isLoading}>
                        {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Fiscal Year *</label>
                      <select {...finForm.register("fiscalYearStart")} style={{ ...inputStyle, cursor: "pointer" }} disabled={isLoading}>
                        {FISCAL_YEARS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Opening Bank Balance <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
                      <input type="number" {...finForm.register("openingBankBalance", { valueAsNumber: true })} placeholder="0.00" style={inputStyle} disabled={isLoading} min={0} step={0.01} />
                    </div>
                    <div>
                      <label style={labelStyle}>Est. Monthly Revenue <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
                      <input type="number" {...finForm.register("monthlyRevenueEstimate", { valueAsNumber: true })} placeholder="0.00" style={inputStyle} disabled={isLoading} min={0} step={0.01} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Est. Monthly Expenses <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
                      <input type="number" {...finForm.register("monthlyExpenseEstimate", { valueAsNumber: true })} placeholder="0.00" style={inputStyle} disabled={isLoading} min={0} step={0.01} />
                    </div>
                    <div>
                      <label style={labelStyle}>Default Tax Rate % <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
                      <input type="number" {...finForm.register("defaultTaxRate", { valueAsNumber: true })} placeholder="18" style={inputStyle} disabled={isLoading} min={0} max={100} step={0.01} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={() => setStep(2)} disabled={isLoading} style={{ ...navBtnBase, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto", padding: "11px 20px" }}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="submit" disabled={isLoading} style={{ ...navBtnBase, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", flex: 1, opacity: isLoading ? 0.75 : 1 }}>
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                      {isLoading ? "Saving…" : "Continue"} {!isLoading && <ArrowRight size={16} />}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── Step 4: Import ── */}
            {step === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  Import your existing data to hit the ground running. You can also do this later from Settings.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(["ZOHO", "TALLY", "CSV", "SKIP"] as ImportChoice[]).map((opt) => {
                    const isActive = importChoice === opt;
                    const labels: Record<ImportChoice, { label: string; desc: string }> = {
                      ZOHO: { label: "Zoho Books", desc: "Import customers, invoices & transactions" },
                      TALLY: { label: "Tally Prime / ERP9", desc: "Import ledgers, vouchers & masters" },
                      CSV: { label: "CSV / Excel Upload", desc: "Upload a spreadsheet of your data" },
                      SKIP: { label: "Skip for now", desc: "Start fresh — you can import later" },
                    };
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setImportChoice(opt)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: isActive ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)", border: `1.5px solid ${isActive ? "#6366f1" : "var(--border)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{labels[opt].label}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{labels[opt].desc}</div>
                        </div>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isActive ? "#6366f1" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {isActive && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366f1" }} />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setStep(3)} disabled={isLoading} style={{ ...navBtnBase, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto", padding: "11px 20px" }}>
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button type="button" onClick={handleImportNext} disabled={isLoading} style={{ ...navBtnBase, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", flex: 1, opacity: isLoading ? 0.75 : 1 }}>
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {isLoading ? "Saving…" : "Continue"} {!isLoading && <ArrowRight size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 5: Integrations ── */}
            {step === 5 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  Connect your existing tools to keep everything in sync automatically.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { name: "Zoho Books", desc: "Accounting & invoicing" },
                    { name: "Tally Prime", desc: "Accounting software" },
                    { name: "Razorpay", desc: "Payment gateway" },
                    { name: "GST Portal", desc: "Direct GSTIN filing" },
                  ].map((int) => (
                    <div key={int.name} style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--bg-base)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Plug size={16} color="var(--text-muted)" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{int.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{int.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                  Integrations can be configured from Settings → Integrations after setup.
                </p>

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setStep(4)} disabled={isLoading} style={{ ...navBtnBase, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto", padding: "11px 20px" }}>
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button type="button" onClick={handleIntegrationsNext} style={{ ...navBtnBase, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", flex: 1 }}>
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 6: Review & Finish ── */}
            {step === 6 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ padding: "16px", borderRadius: 12, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Setup Summary</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: "Business", value: completedData.companyName || "—" },
                      { label: "Type", value: completedData.businessType || "—" },
                      { label: "Industry", value: completedData.industry || "—" },
                      { label: "Location", value: completedData.city && completedData.country ? `${completedData.city}, ${completedData.country}` : "—" },
                      { label: "Currency", value: completedData.currency || "INR" },
                      { label: "Data Import", value: importChoice === "SKIP" ? "Start fresh" : importChoice },
                    ].map((row) => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Full ERP dashboard", "Invoice and payment tracking", "Compliance management", "Document storage"].map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Check size={15} color="#10b981" />
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{f}</span>
                    </div>
                  ))}
                </div>

                {error && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setStep(5)} disabled={isLoading} style={{ ...navBtnBase, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto", padding: "11px 20px" }}>
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button type="button" onClick={handleComplete} disabled={isLoading} style={{ ...navBtnBase, background: "linear-gradient(135deg, #10b981, #059669)", color: "white", flex: 1, opacity: isLoading ? 0.75 : 1, boxShadow: isLoading ? "none" : "0 6px 20px rgba(16,185,129,0.3)" }}>
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {isLoading ? "Setting up your account…" : "Launch My Dashboard"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
