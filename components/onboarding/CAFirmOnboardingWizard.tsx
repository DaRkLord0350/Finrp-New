"use client";

// ============================================================
// CAFirmOnboardingWizard — 6-step wizard for CA_FIRM_ADMIN.
// Steps:
//   1. Firm Information
//   2. Office Details
//   3. Team Setup
//   4. Service Configuration
//   5. Client Migration
//   6. Review & Finish
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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
  Users,
  Settings,
  Upload,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import {
  actionSaveFirmInfo,
  actionSaveOfficeDetails,
  actionSaveTeamSetup,
  actionSaveServiceConfig,
  actionSaveClientMigration,
  actionCompleteFirmOnboarding,
} from "@/actions/ca-firm-onboarding";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const firmInfoSchema = z.object({
  firmName: z.string().min(2, "Firm name must be at least 2 characters"),
  registrationNumber: z
    .string()
    .optional()
    .or(z.literal("")),
  email: z.string().email("Please enter a valid email"),
  phone: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/, "Please enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

const officeSchema = z.object({
  address: z.string().min(5, "Please enter a complete address"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  country: z.string().min(2, "Country is required"),
});

const teamSchema = z.object({
  teamSize: z.string().min(1, "Please select team size"),
  inviteEmails: z.array(z.object({ email: z.string().email("Invalid email").or(z.literal("")) })),
});

type FirmInfoInput = z.infer<typeof firmInfoSchema>;
type OfficeInput = z.infer<typeof officeSchema>;
type TeamInput = z.infer<typeof teamSchema>;
type MigrationChoice = "CSV" | "ZOHO" | "SKIP";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STEPS = [
  { id: 1, title: "Firm Info", icon: Building2 },
  { id: 2, title: "Office", icon: MapPin },
  { id: 3, title: "Team", icon: Users },
  { id: 4, title: "Services", icon: Settings },
  { id: 5, title: "Clients", icon: Upload },
  { id: 6, title: "Finish", icon: CheckCircle2 },
];

const TEAM_SIZES = ["1 (Solo)", "2-5", "6-10", "11-25", "26-50", "50+"];

const SERVICES = [
  { id: "GST", label: "GST Filing & Compliance" },
  { id: "INCOME_TAX", label: "Income Tax Returns" },
  { id: "ROC", label: "ROC / MCA Filings" },
  { id: "AUDIT", label: "Statutory Audit" },
  { id: "TDS", label: "TDS Returns" },
  { id: "PAYROLL", label: "Payroll Processing" },
  { id: "BOOKKEEPING", label: "Bookkeeping & Accounting" },
  { id: "ADVISORY", label: "Business Advisory" },
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

const navBtn: React.CSSProperties = {
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
export function CAFirmOnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>(["GST", "INCOME_TAX"]);
  const [migrationChoice, setMigrationChoice] = useState<MigrationChoice>("SKIP");
  const [completedData, setCompletedData] = useState<{
    firmName?: string;
    registrationNumber?: string;
    city?: string;
    state?: string;
    teamSize?: string;
  }>({});

  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;

  // ── Step 1: Firm Info ────────────────────────────────────────────────────
  const firmForm = useForm<FirmInfoInput>({
    resolver: zodResolver(firmInfoSchema),
    defaultValues: { firmName: "", registrationNumber: "", email: "", phone: "" },
  });

  async function handleFirmNext(data: FirmInfoInput) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionSaveFirmInfo({
        firmName: data.firmName,
        registrationNumber: data.registrationNumber || undefined,
        email: data.email,
        phone: data.phone || undefined,
      });
      if (!res.success) throw new Error(res.error);
      setCompletedData((p) => ({ ...p, firmName: data.firmName, registrationNumber: data.registrationNumber || undefined }));
      setStep(2);
    } catch (e) {
      setError((e as Error).message ?? "Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 2: Office Details ───────────────────────────────────────────────
  const officeForm = useForm<OfficeInput>({
    resolver: zodResolver(officeSchema),
    defaultValues: { address: "", city: "", state: "", country: "India" },
  });

  async function handleOfficeNext(data: OfficeInput) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionSaveOfficeDetails(data);
      if (!res.success) throw new Error(res.error);
      setCompletedData((p) => ({ ...p, city: data.city, state: data.state }));
      setStep(3);
    } catch (e) {
      setError((e as Error).message ?? "Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 3: Team Setup ───────────────────────────────────────────────────
  const teamForm = useForm<TeamInput>({
    resolver: zodResolver(teamSchema),
    defaultValues: { teamSize: "", inviteEmails: [{ email: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control: teamForm.control, name: "inviteEmails" });

  async function handleTeamNext(data: TeamInput) {
    setIsLoading(true);
    setError(null);
    try {
      const emails = data.inviteEmails.map((e) => e.email).filter((e) => e.trim());
      const res = await actionSaveTeamSetup({ teamSize: data.teamSize, inviteEmails: emails });
      if (!res.success) throw new Error(res.error);
      setCompletedData((p) => ({ ...p, teamSize: data.teamSize }));
      setStep(4);
    } catch (e) {
      setError((e as Error).message ?? "Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 4: Services ─────────────────────────────────────────────────────
  async function handleServicesNext() {
    if (selectedServices.length === 0) {
      setError("Please select at least one service.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionSaveServiceConfig({ services: selectedServices });
      if (!res.success) throw new Error(res.error);
      setStep(5);
    } catch (e) {
      setError((e as Error).message ?? "Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  // ── Step 5: Client Migration ─────────────────────────────────────────────
  async function handleMigrationNext() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionSaveClientMigration(migrationChoice);
      if (!res.success) throw new Error(res.error);
      setStep(6);
    } catch (e) {
      setError((e as Error).message ?? "Failed to save. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 6: Complete ─────────────────────────────────────────────────────
  async function handleComplete() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionCompleteFirmOnboarding();
      if (!res.success) throw new Error(res.error);
      // Profile done → choose a plan + activate before entering the portal.
      router.push("/onboarding/plan");
      router.refresh();
    } catch (e) {
      setError((e as Error).message ?? "Failed to complete setup.");
      setIsLoading(false);
    }
  }

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
          position: "fixed", top: "8%", left: "50%", transform: "translateX(-50%)",
          width: 800, height: 600,
          background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
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
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, transition: "all 0.2s", background: isCompleted ? "linear-gradient(135deg, #10b981, #059669)" : isActive ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "var(--bg-elevated)", border: `1.5px solid ${isCompleted ? "#10b981" : isActive ? "#6366f1" : "var(--border)"}`, color: isCompleted || isActive ? "white" : "var(--text-muted)" }}>
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
            <motion.div initial={false} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.4, ease: "easeInOut" }} style={{ height: "100%", background: "linear-gradient(90deg, #6366f1, #10b981)", borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Step {step} of {STEPS.length}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{Math.round(progressPct)}% complete</span>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }} role="alert">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 20, padding: "36px 40px", boxShadow: "var(--shadow-lg)" }}>

            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-400)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                CA Firm Setup — Step {step}
              </p>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.025em", lineHeight: 1.2 }}>
                {step === 1 && "Firm Information"}
                {step === 2 && "Office Details"}
                {step === 3 && "Team Setup"}
                {step === 4 && "Services Offered"}
                {step === 5 && "Client Migration"}
                {step === 6 && "Review & Finish"}
              </h1>
            </div>

            {/* ── Step 1: Firm Info ── */}
            {step === 1 && (
              <form onSubmit={firmForm.handleSubmit(handleFirmNext)}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Firm Name *</label>
                    <input {...firmForm.register("firmName")} placeholder="e.g. Sharma & Associates" style={inputStyle} disabled={isLoading} />
                    {firmForm.formState.errors.firmName && <span style={errorStyle}>{firmForm.formState.errors.firmName.message}</span>}
                  </div>
                  <div>
                    <label style={labelStyle}>ICAI Registration Number <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
                    <input {...firmForm.register("registrationNumber")} placeholder="e.g. 123456E" style={inputStyle} disabled={isLoading} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}>Firm registration number issued by ICAI</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Professional Email *</label>
                      <input {...firmForm.register("email")} type="email" placeholder="firm@example.com" style={inputStyle} disabled={isLoading} />
                      {firmForm.formState.errors.email && <span style={errorStyle}>{firmForm.formState.errors.email.message}</span>}
                    </div>
                    <div>
                      <label style={labelStyle}>Phone Number <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
                      <input {...firmForm.register("phone")} placeholder="+91 98765 43210" style={inputStyle} disabled={isLoading} />
                      {firmForm.formState.errors.phone && <span style={errorStyle}>{firmForm.formState.errors.phone.message}</span>}
                    </div>
                  </div>
                  <button type="submit" disabled={isLoading} style={{ ...navBtn, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", opacity: isLoading ? 0.75 : 1 }}>
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {isLoading ? "Saving…" : "Continue"} {!isLoading && <ArrowRight size={16} />}
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 2: Office ── */}
            {step === 2 && (
              <form onSubmit={officeForm.handleSubmit(handleOfficeNext)}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Office Address *</label>
                    <input {...officeForm.register("address")} placeholder="e.g. 3rd Floor, Trade Centre, Nariman Point" style={inputStyle} disabled={isLoading} />
                    {officeForm.formState.errors.address && <span style={errorStyle}>{officeForm.formState.errors.address.message}</span>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>City *</label>
                      <input {...officeForm.register("city")} placeholder="Mumbai" style={inputStyle} disabled={isLoading} />
                      {officeForm.formState.errors.city && <span style={errorStyle}>{officeForm.formState.errors.city.message}</span>}
                    </div>
                    <div>
                      <label style={labelStyle}>State *</label>
                      <input {...officeForm.register("state")} placeholder="Maharashtra" style={inputStyle} disabled={isLoading} />
                      {officeForm.formState.errors.state && <span style={errorStyle}>{officeForm.formState.errors.state.message}</span>}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Country *</label>
                    <input {...officeForm.register("country")} placeholder="India" style={inputStyle} disabled={isLoading} />
                    {officeForm.formState.errors.country && <span style={errorStyle}>{officeForm.formState.errors.country.message}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={() => setStep(1)} disabled={isLoading} style={{ ...navBtn, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto", padding: "11px 20px" }}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="submit" disabled={isLoading} style={{ ...navBtn, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", flex: 1, opacity: isLoading ? 0.75 : 1 }}>
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                      {isLoading ? "Saving…" : "Continue"} {!isLoading && <ArrowRight size={16} />}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── Step 3: Team ── */}
            {step === 3 && (
              <form onSubmit={teamForm.handleSubmit(handleTeamNext)}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Number of Team Members *</label>
                    <select {...teamForm.register("teamSize")} style={{ ...inputStyle, cursor: "pointer" }} disabled={isLoading}>
                      <option value="">Select team size...</option>
                      {TEAM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {teamForm.formState.errors.teamSize && <span style={errorStyle}>{teamForm.formState.errors.teamSize.message}</span>}
                  </div>

                  <div>
                    <label style={labelStyle}>Invite Team Members <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(Optional)</span></label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {fields.map((field, idx) => (
                        <div key={field.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            {...teamForm.register(`inviteEmails.${idx}.email`)}
                            type="email"
                            placeholder={`teammate${idx + 1}@firm.com`}
                            style={{ ...inputStyle, flex: 1 }}
                            disabled={isLoading}
                          />
                          {fields.length > 1 && (
                            <button type="button" onClick={() => remove(idx)} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <X size={14} color="var(--text-muted)" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {fields.length < 5 && (
                      <button type="button" onClick={() => append({ email: "" })} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--brand-400)", fontWeight: 600 }}>
                        <Plus size={14} /> Add another email
                      </button>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, display: "block" }}>Invites will be sent — you can also add more later from Settings.</span>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={() => setStep(2)} disabled={isLoading} style={{ ...navBtn, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto", padding: "11px 20px" }}>
                      <ArrowLeft size={15} /> Back
                    </button>
                    <button type="submit" disabled={isLoading} style={{ ...navBtn, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", flex: 1, opacity: isLoading ? 0.75 : 1 }}>
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                      {isLoading ? "Saving…" : "Continue"} {!isLoading && <ArrowRight size={16} />}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── Step 4: Services ── */}
            {step === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  Select the services your firm provides. This customizes your compliance dashboard.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {SERVICES.map((svc) => {
                    const isActive = selectedServices.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => toggleService(svc.id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: isActive ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)", border: `1.5px solid ${isActive ? "#6366f1" : "var(--border)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                      >
                        <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isActive ? "#6366f1" : "var(--border)"}`, background: isActive ? "#6366f1" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                          {isActive && <Check size={11} color="white" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>{svc.label}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedServices.length === 0 && <span style={{ fontSize: 12, color: "#ef4444" }}>Select at least one service</span>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setStep(3)} disabled={isLoading} style={{ ...navBtn, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto", padding: "11px 20px" }}>
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button type="button" onClick={handleServicesNext} disabled={isLoading || selectedServices.length === 0} style={{ ...navBtn, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", flex: 1, opacity: isLoading || selectedServices.length === 0 ? 0.65 : 1 }}>
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {isLoading ? "Saving…" : "Continue"} {!isLoading && <ArrowRight size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 5: Client Migration ── */}
            {step === 5 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  Import your existing client list to get started immediately.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {([
                    { id: "CSV" as MigrationChoice, label: "CSV / Excel Import", desc: "Upload a spreadsheet with client names and details" },
                    { id: "ZOHO" as MigrationChoice, label: "Import from Zoho", desc: "Sync clients directly from Zoho CRM or Books" },
                    { id: "SKIP" as MigrationChoice, label: "Start Fresh", desc: "Add clients manually — takes only a few minutes" },
                  ] as const).map((opt) => {
                    const isActive = migrationChoice === opt.id;
                    return (
                      <button key={opt.id} type="button" onClick={() => setMigrationChoice(opt.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: isActive ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)", border: `1.5px solid ${isActive ? "#6366f1" : "var(--border)"}`, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{opt.label}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{opt.desc}</div>
                        </div>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isActive ? "#6366f1" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {isActive && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366f1" }} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setStep(4)} disabled={isLoading} style={{ ...navBtn, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto", padding: "11px 20px" }}>
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button type="button" onClick={handleMigrationNext} disabled={isLoading} style={{ ...navBtn, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", flex: 1, opacity: isLoading ? 0.75 : 1 }}>
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {isLoading ? "Saving…" : "Continue"} {!isLoading && <ArrowRight size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 6: Review & Finish ── */}
            {step === 6 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ padding: "16px", borderRadius: 12, background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Firm Setup Summary</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: "Firm Name", value: completedData.firmName || "—" },
                      { label: "ICAI Reg. No.", value: completedData.registrationNumber || "Not provided" },
                      { label: "Location", value: completedData.city && completedData.state ? `${completedData.city}, ${completedData.state}` : "—" },
                      { label: "Team Size", value: completedData.teamSize || "—" },
                      { label: "Services", value: `${selectedServices.length} selected` },
                      { label: "Client Migration", value: migrationChoice === "SKIP" ? "Start fresh" : migrationChoice },
                    ].map((row) => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "Multi-client compliance dashboard",
                    "Team workload management",
                    "Document management & e-signing",
                    "Compliance templates & automation",
                  ].map((f) => (
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
                  <button type="button" onClick={() => setStep(5)} disabled={isLoading} style={{ ...navBtn, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto", padding: "11px 20px" }}>
                    <ArrowLeft size={15} /> Back
                  </button>
                  <button type="button" onClick={handleComplete} disabled={isLoading} style={{ ...navBtn, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", flex: 1, opacity: isLoading ? 0.75 : 1, boxShadow: isLoading ? "none" : "0 6px 20px rgba(99,102,241,0.3)" }}>
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {isLoading ? "Setting up your firm…" : "Launch CA Portal"}
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
