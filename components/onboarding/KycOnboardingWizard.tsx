"use client";

// ============================================================
// KycOnboardingWizard — Module 2. Replaces the business-detail
// portion of the old 6-step CustomerOnboardingWizard with a
// KYC-grade flow that calls TBX for GST/PAN verification and
// collects signatories/directors/documents before workspace
// activation. The old wizard's Financial Setup / Import Data /
// Connect Integrations steps are NOT KYC-blocking (see Module 10's
// own criteria) — they move to post-activation prompts, not here.
//
// Steps: Business Info -> GST -> PAN -> Signatories & Directors ->
// Address -> Documents -> Preview -> Submit -> Status.
//
// Resume is driven by OrgOnboardingStage.status === "COMPLETED",
// never by "is this field non-empty" — a CA-prefilled-but-never-
// verified GSTIN must not cause the wizard to skip real TBX
// verification (see docs/TBX_FOUNDATION.md §13 Risk 2).
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Zap,
  Building2,
  Receipt,
  Landmark,
  Users,
  MapPin,
  FileText,
  ClipboardCheck,
  CheckCircle2,
  ShieldCheck,
  SkipForward,
} from "lucide-react";
import RelatedPartiesSection, { type RelatedParty } from "@/components/settings/organization/RelatedPartiesSection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WizardProfile {
  businessName?: string | null;
  businessType?: string | null;
  industry?: string | null;
  gstin?: string | null;
  gstVerificationStatus?: string | null;
  pan?: string | null;
  panVerificationStatus?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  operationalAddress?: { address?: string; city?: string; state?: string; country?: string; pincode?: string } | null;
}

interface WizardStage {
  stage: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
}

interface WizardDocument {
  documentType: string;
}

interface WizardState {
  profile: WizardProfile | null;
  stages: WizardStage[];
  relatedParties: RelatedParty[];
  documents: WizardDocument[];
}

const STEPS = [
  { key: "business-info", stage: "BUSINESS_INFO_COMPLETED", title: "Business Info", icon: Building2 },
  { key: "gst", stage: "GST_VERIFIED", title: "GST", icon: Receipt },
  { key: "pan", stage: "PAN_VERIFIED", title: "PAN", icon: Landmark },
  { key: "people", stage: "SIGNATORY_ADDED", title: "People", icon: Users },
  { key: "address", stage: "ADDRESS_COMPLETED", title: "Address", icon: MapPin },
  { key: "documents", stage: "DOCUMENTS_UPLOADED", title: "Documents", icon: FileText },
  { key: "preview", stage: null, title: "Preview", icon: ClipboardCheck },
  { key: "submit", stage: "KYC_SUBMITTED", title: "Submit", icon: CheckCircle2 },
] as const;

const REQUIRED_DOC_TYPES = [
  { key: "PAN", label: "PAN Card" },
  { key: "GST_CERTIFICATE", label: "GST Certificate" },
  { key: "ADDRESS_PROOF", label: "Address Proof" },
];

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
const primaryBtn: React.CSSProperties = { ...navBtnBase, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white", flex: 1 };
const backBtn: React.CSSProperties = { ...navBtnBase, background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", flex: "0 0 auto" };
const skipBtn: React.CSSProperties = { ...navBtnBase, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", flex: "0 0 auto" };

function VerificationStatusBadge({ status }: { status?: string | null }) {
  const map: Record<string, { bg: string; color: string; text: string }> = {
    VERIFIED: { bg: "#10b98120", color: "#10b981", text: "Verified" },
    FAILED: { bg: "#ef444420", color: "#ef4444", text: "Verification failed" },
    PENDING: { bg: "#f59e0b20", color: "#f59e0b", text: "Pending" },
  };
  const s = map[status ?? ""] ?? null;
  if (!s) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: s.bg, color: s.color, marginTop: 8 }}>
      <ShieldCheck size={12} /> {s.text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------
export function KycOnboardingWizard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<WizardState | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Form-local fields
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [industry, setIndustry] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [country, setCountry] = useState("India");
  const [pincode, setPincode] = useState("");
  const [hasOpAddress, setHasOpAddress] = useState(false);
  const [opAddress, setOpAddress] = useState({ address: "", city: "", state: "", country: "", pincode: "" });

  async function loadState() {
    const res = await fetch("/api/onboarding/kyc");
    if (!res.ok) return;
    const data: WizardState = await res.json();
    setState(data);
    setBusinessName(data.profile?.businessName ?? "");
    setBusinessType(data.profile?.businessType ?? "");
    setIndustry(data.profile?.industry ?? "");
    setGstin(data.profile?.gstin ?? "");
    setPan(data.profile?.pan ?? "");
    setAddress(data.profile?.address ?? "");
    setCity(data.profile?.city ?? "");
    setAddrState(data.profile?.state ?? "");
    setCountry(data.profile?.country ?? "India");
    setPincode(data.profile?.pincode ?? "");
    if (data.profile?.operationalAddress) {
      setHasOpAddress(true);
      setOpAddress({
        address: data.profile.operationalAddress.address ?? "",
        city: data.profile.operationalAddress.city ?? "",
        state: data.profile.operationalAddress.state ?? "",
        country: data.profile.operationalAddress.country ?? "",
        pincode: data.profile.operationalAddress.pincode ?? "",
      });
    }

    // Resume from the first non-completed stage — never from raw field presence.
    const firstIncomplete = STEPS.findIndex(
      (s) => s.stage && data.stages.find((st) => st.stage === s.stage)?.status !== "COMPLETED"
    );
    setStep(firstIncomplete === -1 ? STEPS.length - 1 : firstIncomplete);
    setLoading(false);
  }

  useEffect(() => {
    loadState();
  }, []);

  async function saveStep(stepKey: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/kyc/${stepKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      await loadState();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save. Please try again.");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/kyc/submit", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !state) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <Loader2 size={24} className="animate-spin" color="var(--text-muted)" />
      </div>
    );
  }

  if (submitted) {
    return (
      <WizardShell step={STEPS.length - 1}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16, padding: "20px 0" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#10b98120", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={32} color="#10b981" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>KYC submitted</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 420, lineHeight: 1.6 }}>
            Your organization has been registered with TBX and your details are being verified. You can start using
            your workspace now — some actions will unlock once verification completes.
          </p>
          <button onClick={() => { router.push("/onboarding/plan"); router.refresh(); }} style={{ ...primaryBtn, flex: "0 0 auto", padding: "12px 28px" }}>
            Continue to FinRP <ArrowRight size={16} />
          </button>
        </div>
      </WizardShell>
    );
  }

  const current = STEPS[step];

  return (
    <WizardShell step={step}>
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

      {/* ── Business Info ── */}
      {current.key === "business-info" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={labelStyle}>Legal Business Name *</label>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Private Limited" style={inputStyle} disabled={busy} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Business Type</label>
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }} disabled={busy}>
                <option value="">Select type...</option>
                {["Sole Proprietorship", "Partnership", "Limited Liability Partnership (LLP)", "Private Limited Company", "Public Limited Company", "One Person Company (OPC)", "Other"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Industry *</label>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }} disabled={busy}>
                <option value="">Select industry...</option>
                {["Technology", "Manufacturing", "Retail / E-commerce", "Healthcare", "Financial Services", "Real Estate", "Education", "Other"].map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={() => saveStep("business-info", { companyName: businessName, businessType, industry }).then(goNext).catch(() => {})}
            disabled={busy || !businessName.trim() || !industry}
            style={{ ...primaryBtn, opacity: busy ? 0.75 : 1 }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? "Saving…" : "Continue"} {!busy && <ArrowRight size={16} />}
          </button>
        </div>
      )}

      {/* ── GST ── */}
      {current.key === "gst" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            We&apos;ll verify your GSTIN with TBX. If your business isn&apos;t GST-registered, skip this step.
          </p>
          <div>
            <label style={labelStyle}>GSTIN</label>
            <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} style={inputStyle} disabled={busy} />
            <VerificationStatusBadge status={state.profile?.gstVerificationStatus} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={goBack} disabled={busy} style={backBtn}><ArrowLeft size={15} /> Back</button>
            <button onClick={() => saveStep("gst", { skip: true }).then(goNext).catch(() => {})} disabled={busy} style={skipBtn}>
              <SkipForward size={14} /> Skip
            </button>
            <button
              onClick={() => saveStep("gst", { gstin }).then(goNext).catch(() => {})}
              disabled={busy || !gstin.trim()}
              style={{ ...primaryBtn, opacity: busy ? 0.75 : 1 }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {busy ? "Verifying…" : "Verify & Continue"}
            </button>
          </div>
        </div>
      )}

      {/* ── PAN ── */}
      {current.key === "pan" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            We&apos;ll verify your business PAN with TBX.
          </p>
          <div>
            <label style={labelStyle}>PAN *</label>
            <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} style={inputStyle} disabled={busy} />
            <VerificationStatusBadge status={state.profile?.panVerificationStatus} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={goBack} disabled={busy} style={backBtn}><ArrowLeft size={15} /> Back</button>
            <button onClick={() => saveStep("pan", { skip: true }).then(goNext).catch(() => {})} disabled={busy} style={skipBtn}>
              <SkipForward size={14} /> Skip
            </button>
            <button
              onClick={() => saveStep("pan", { pan }).then(goNext).catch(() => {})}
              disabled={busy || !pan.trim()}
              style={{ ...primaryBtn, opacity: busy ? 0.75 : 1 }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {busy ? "Verifying…" : "Verify & Continue"}
            </button>
          </div>
        </div>
      )}

      {/* ── People (Signatories + Directors, unified) ── */}
      {current.key === "people" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Add everyone authorized to act for this business — directors, partners, and signatories. A person can hold
            more than one role.
          </p>
          <div style={{ margin: "0 -8px" }}>
            <RelatedPartiesSection initialParties={state.relatedParties} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={goBack} disabled={busy} style={backBtn}><ArrowLeft size={15} /> Back</button>
            <button
              onClick={() => saveStep("people", {}).then(goNext).catch(() => {})}
              disabled={busy}
              style={{ ...primaryBtn, opacity: busy ? 0.75 : 1 }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? "Saving…" : "Continue"} {!busy && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Address ── */}
      {current.key === "address" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", margin: 0 }}>Registered Address</p>
          <div>
            <label style={labelStyle}>Street Address *</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} disabled={busy} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>City *</label><input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} disabled={busy} /></div>
            <div><label style={labelStyle}>State *</label><input value={addrState} onChange={(e) => setAddrState(e.target.value)} style={inputStyle} disabled={busy} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Country *</label><input value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle} disabled={busy} /></div>
            <div><label style={labelStyle}>Pincode</label><input value={pincode} onChange={(e) => setPincode(e.target.value)} style={inputStyle} disabled={busy} /></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={hasOpAddress} onChange={(e) => setHasOpAddress(e.target.checked)} />
            Operational address differs from registered address
          </label>
          {hasOpAddress && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <input placeholder="Operational address" value={opAddress.address} onChange={(e) => setOpAddress({ ...opAddress, address: e.target.value })} style={{ ...inputStyle, gridColumn: "1 / -1" }} />
              <input placeholder="City" value={opAddress.city} onChange={(e) => setOpAddress({ ...opAddress, city: e.target.value })} style={inputStyle} />
              <input placeholder="State" value={opAddress.state} onChange={(e) => setOpAddress({ ...opAddress, state: e.target.value })} style={inputStyle} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={goBack} disabled={busy} style={backBtn}><ArrowLeft size={15} /> Back</button>
            <button
              onClick={() =>
                saveStep("address", {
                  address, city, state: addrState, country, pincode,
                  operationalAddress: hasOpAddress ? opAddress : null,
                }).then(goNext).catch(() => {})
              }
              disabled={busy || !address.trim() || !city.trim() || !addrState.trim() || !country.trim()}
              style={{ ...primaryBtn, opacity: busy ? 0.75 : 1 }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? "Saving…" : "Continue"} {!busy && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* ── Documents ── */}
      {current.key === "documents" && (
        <DocumentsStep
          documents={state.documents}
          busy={busy}
          onBack={goBack}
          onContinue={() => saveStep("documents", {}).then(goNext).catch(() => {})}
          onUploaded={loadState}
        />
      )}

      {/* ── Preview ── */}
      {current.key === "preview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: 16, borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Review your details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Business Name", value: state.profile?.businessName || "—" },
                { label: "GSTIN", value: `${state.profile?.gstin || "—"} ${state.profile?.gstVerificationStatus ? `(${state.profile.gstVerificationStatus})` : ""}` },
                { label: "PAN", value: `${state.profile?.pan || "—"} ${state.profile?.panVerificationStatus ? `(${state.profile.panVerificationStatus})` : ""}` },
                { label: "Signatories & Directors", value: `${state.relatedParties.length} added` },
                { label: "Address", value: [state.profile?.city, state.profile?.state, state.profile?.country].filter(Boolean).join(", ") || "—" },
                { label: "Documents", value: `${state.documents.length} uploaded` },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 600, textAlign: "right" }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={goBack} disabled={busy} style={backBtn}><ArrowLeft size={15} /> Back</button>
            <button onClick={goNext} style={primaryBtn}>Continue <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {/* ── Submit ── */}
      {current.key === "submit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
            Submitting registers your organization with TBX and starts verification of your bank account, documents,
            and signatories. You can access your workspace immediately — some actions unlock once verification completes.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {["Business identity (PAN/GST) checked against TBX", "Signatories & directors on file", "Documents uploaded for review", "Bank account verification queued"].map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Check size={15} color="#10b981" />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{f}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={goBack} disabled={busy} style={backBtn}><ArrowLeft size={15} /> Back</button>
            <button
              onClick={handleSubmit}
              disabled={busy}
              style={{ ...navBtnBase, background: "linear-gradient(135deg, #10b981, #059669)", color: "white", flex: 1, opacity: busy ? 0.75 : 1 }}
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {busy ? "Submitting…" : "Submit for Verification"}
            </button>
          </div>
        </div>
      )}
    </WizardShell>
  );
}

// ---------------------------------------------------------------------------
// Documents step (focused uploader for the required KYC document set)
// ---------------------------------------------------------------------------
function DocumentsStep({
  documents,
  busy,
  onBack,
  onContinue,
  onUploaded,
}: {
  documents: WizardDocument[];
  busy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onUploaded: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState<string | null>(null);

  async function handleFile(docType: string, label: string, file: File) {
    if (file.size > 10 * 1024 * 1024) return;
    setUploading(docType);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await fetch("/api/settings/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: docType, displayName: label, fileName: file.name, mimeType: file.type, fileSize: file.size, fileUrl: base64 }),
      });
      await onUploaded();
    } finally {
      setUploading(null);
    }
  }

  const uploadedTypes = new Set(documents.map((d) => d.documentType));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
        Upload the documents below. You can add more from Settings → Documents later.
      </p>
      {REQUIRED_DOC_TYPES.map((t) => {
        const done = uploadedTypes.has(t.key);
        const isUploading = uploading === t.key;
        return (
          <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: `1px solid ${done ? "#10b98140" : "var(--border)"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {done ? <Check size={16} color="#10b981" /> : <FileText size={16} color="var(--text-muted)" />}
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{t.label}</span>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", cursor: "pointer" }}>
              {isUploading ? "Uploading…" : done ? "Replace" : "Upload"}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(t.key, t.label, file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} disabled={busy} style={backBtn}><ArrowLeft size={15} /> Back</button>
        <button onClick={onContinue} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.75 : 1 }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? "Saving…" : "Continue"} {!busy && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared shell (glow + progress pills + card) — matches the existing
// onboarding wizards' visual language exactly.
// ---------------------------------------------------------------------------
function WizardShell({ step, children }: { step: number; children: React.ReactNode }) {
  const progressPct = (step / (STEPS.length - 1)) * 100;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px 48px" }}>
      <div aria-hidden style={{ position: "fixed", top: "8%", left: "50%", transform: "translateX(-50%)", width: 800, height: 600, background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ width: "100%", maxWidth: 680, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          <div style={{ width: 34, height: 34, background: "linear-gradient(135deg, #6366f1, #10b981)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} color="white" />
          </div>
          <span style={{ fontSize: 20, fontWeight: 800, background: "linear-gradient(135deg, #818cf8, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>
            FinRP
          </span>
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
            {STEPS.map((s, idx) => {
              const isCompleted = idx < step;
              const isActive = idx === step;
              const Icon = s.icon;
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 48 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: isCompleted ? "linear-gradient(135deg, #10b981, #059669)" : isActive ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "var(--bg-elevated)", border: `1.5px solid ${isCompleted ? "#10b981" : isActive ? "#6366f1" : "var(--border)"}`, color: isCompleted || isActive ? "white" : "var(--text-muted)" }}>
                      {isCompleted ? <Check size={12} strokeWidth={3} /> : <Icon size={12} />}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--text-primary)" : isCompleted ? "var(--accent-500)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {s.title}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, borderRadius: 2, minWidth: 8, background: isCompleted ? "linear-gradient(90deg, #10b981, #6366f1)" : "var(--border)" }} />
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ height: 4, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
            <motion.div initial={false} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.4 }} style={{ height: "100%", background: "linear-gradient(90deg, #6366f1, #10b981)", borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Step {step + 1} of {STEPS.length}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{Math.round(progressPct)}% complete</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 20, padding: "36px 40px", boxShadow: "var(--shadow-lg)" }}
          >
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-400)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                KYC Onboarding — Step {step + 1}
              </p>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.025em", lineHeight: 1.2 }}>
                {STEPS[step].title}
              </h1>
            </div>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
