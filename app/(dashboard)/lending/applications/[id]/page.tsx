"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  FileText, Landmark, CheckCircle2, FileSignature,
  Wallet, History as HistoryIcon, Upload, Bot, CreditCard, ShieldAlert, ShieldX, BadgeCheck,
} from "lucide-react";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";
import { generateDeviceFingerprint } from "@/lib/fraud/client-fingerprint";

const STAGES = ["APPLICATION", "DOCUMENT_COLLECTION", "VERIFICATION", "CREDIT_BUREAU", "AML", "FRAUD", "RISK_SCORE", "APPROVAL_MATRIX", "SANCTION", "AGREEMENT", "DISBURSEMENT", "REPAYMENT"];
const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "documents", label: "Documents", icon: Upload },
  { id: "collateral", label: "Collateral", icon: Landmark },
  { id: "verification", label: "Verification", icon: BadgeCheck },
  { id: "credit", label: "Credit Bureau", icon: CreditCard },
  { id: "aml", label: "AML", icon: ShieldAlert },
  { id: "fraud", label: "Fraud", icon: ShieldX },
  { id: "approval", label: "Approval", icon: CheckCircle2 },
  { id: "letters", label: "Letters & Agreement", icon: FileSignature },
  { id: "disbursement", label: "Disbursement", icon: Wallet },
  { id: "history", label: "History", icon: HistoryIcon },
] as const;

interface EligibilityCheck { id: string; ruleName: string; passed: boolean; message: string }
interface LoanDocument { id: string; docType: string; fileName: string; status: string }
interface Collateral { id: string; type: string; description: string; estimatedValue: string; status: string }
interface ApprovalStep { id: string; level: number; approverRole: string; status: string; comments: string | null }
interface GeneratedLetter { id: string; type: string; version: number; status: string }
interface AgreementSignatory { id: string; role: string; name: string; status: string }
interface Agreement { id: string; version: number; status: string; signatories: AgreementSignatory[] }
interface Disbursement { id: string; amount: string; mode: string; status: string }
interface HistoryEntry { id: string; event: string; detail: string | null; createdAt: string }

interface ApplicationDetail {
  id: string;
  applicationNumber: string;
  status: string;
  stage: string;
  requestedAmount: string;
  approvedAmount: string | null;
  requestedTenureMonths: number;
  interestRateOffered: string | null;
  emiAmount: string | null;
  purpose: string | null;
  riskScore: number | null;
  riskCategory: string | null;
  rejectionReason: string | null;
  customer: { id: string; name: string };
  product: { name: string };
  documents: LoanDocument[];
  eligibilityChecks: EligibilityCheck[];
  collaterals: Collateral[];
  approvalSteps: ApprovalStep[];
  generatedLetters: GeneratedLetter[];
  agreements: Agreement[];
  disbursements: Disbursement[];
}

function fmt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "—";
}

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ application: ApplicationDetail }>(["lending", "application", id], () =>
    api(`/api/lending/applications/${id}`)
  );
  const refresh = () => qc.invalidate(["lending", "application", id]);

  if (isLoading || !data) return <p style={{ color: "var(--text-muted)" }}>Loading application…</p>;
  const app = data.application;
  const stageIndex = STAGES.indexOf(app.stage);

  const advance = async (stage: string) => {
    try {
      await api(`/api/lending/applications/${id}/advance`, { method: "POST", body: JSON.stringify({ stage }) });
      toast.success(`${stage.replace(/_/g, " ")} marked complete`);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const scoreRisk = async () => {
    try {
      await api(`/api/lending/applications/${id}/risk-score`, { method: "POST", body: JSON.stringify({}) });
      toast.success("Risk score computed — approval matrix generated");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const decideStep = async (stepId: string, decision: "APPROVED" | "REJECTED") => {
    const comments = decision === "REJECTED" ? window.prompt("Rejection reason?") ?? "" : undefined;
    try {
      await api(`/api/lending/applications/${id}/approval-steps/${stepId}`, { method: "PATCH", body: JSON.stringify({ decision, comments }) });
      toast.success(`Step ${decision.toLowerCase()}`);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const lifecycle = async (action: string) => {
    const reason = ["reject", "withdraw", "hold"].includes(action) ? window.prompt("Reason?") ?? undefined : undefined;
    try {
      await api(`/api/lending/applications/${id}/lifecycle`, { method: "POST", body: JSON.stringify({ action, reason }) });
      toast.success(`Application ${action.replace("-", " ")}ed`);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{app.applicationNumber}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            {app.customer.name} · {app.product.name} · {fmt(app.requestedAmount)} / {app.requestedTenureMonths}mo
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusBadge status={app.status} size="md" />
          {["DRAFT", "IN_PROGRESS", "ON_HOLD"].includes(app.status) && (
            <button onClick={() => lifecycle("reject")} style={dangerBtn}>Reject</button>
          )}
          {["DRAFT", "IN_PROGRESS", "ON_HOLD", "APPROVED", "SANCTIONED"].includes(app.status) && (
            <button onClick={() => lifecycle("withdraw")} style={secondaryBtn}>Withdraw</button>
          )}
        </div>
      </div>

      {/* Stage tracker */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, overflowX: "auto" }}>
        {STAGES.map((s, i) => (
          <div key={s} style={{ flex: 1, minWidth: 70 }}>
            <div style={{ height: 4, borderRadius: 99, background: i <= stageIndex ? "#6366f1" : "var(--border)", marginBottom: 4 }} />
            <p style={{ fontSize: 9, color: i === stageIndex ? "var(--text-primary)" : "var(--text-muted)", fontWeight: i === stageIndex ? 700 : 400, whiteSpace: "nowrap" }}>
              {s.replace(/_/g, " ")}
            </p>
          </div>
        ))}
      </div>

      {/* Stage action bar */}
      {app.status === "IN_PROGRESS" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {app.stage === "DOCUMENT_COLLECTION" && <button onClick={() => advance("DOCUMENT_COLLECTION")} style={primaryBtn}>Complete Document Collection</button>}
          {app.stage === "VERIFICATION" && <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>Open and complete a case from the Verification tab to advance this stage.</span>}
          {app.stage === "CREDIT_BUREAU" && <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>Pull a credit report from the Credit Bureau tab to advance this stage.</span>}
          {app.stage === "AML" && <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>Run a screening from the AML tab to advance this stage.</span>}
          {app.stage === "FRAUD" && <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>Run a screening from the Fraud tab to advance this stage.</span>}
          {app.stage === "RISK_SCORE" && <button onClick={scoreRisk} style={primaryBtn}>Compute Risk Score</button>}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", fontSize: 13, fontWeight: 600,
                background: "none", border: "none", cursor: "pointer",
                color: tab === t.id ? "#818cf8" : "var(--text-muted)",
                borderBottom: tab === t.id ? "2px solid #818cf8" : "2px solid transparent",
              }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab app={app} />}
      {tab === "documents" && <DocumentsTab app={app} onChange={refresh} />}
      {tab === "collateral" && <CollateralTab app={app} onChange={refresh} />}
      {tab === "verification" && <VerificationTab app={app} />}
      {tab === "credit" && <CreditBureauTab app={app} onChange={refresh} />}
      {tab === "aml" && <AMLTab app={app} onChange={refresh} />}
      {tab === "fraud" && <FraudTab app={app} onChange={refresh} />}
      {tab === "approval" && <ApprovalTab app={app} onDecide={decideStep} />}
      {tab === "letters" && <LettersTab app={app} onChange={refresh} />}
      {tab === "disbursement" && <DisbursementTab app={app} onChange={refresh} />}
      {tab === "history" && <HistoryTab id={id} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>{children}</div>;
}

function OverviewTab({ app }: { app: ApplicationDetail }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const explainRejection = async () => {
    setLoadingAi(true);
    try {
      const res = await api(`/api/lending/applications/${app.id}/ai/explain-rejection`, { method: "POST" });
      setExplanation(res.explanation);
    } catch (e) { toast.error((e as Error).message); } finally { setLoadingAi(false); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Terms</h3>
        <Row label="Requested Amount" value={fmt(app.requestedAmount)} />
        <Row label="Approved Amount" value={app.approvedAmount ? fmt(app.approvedAmount) : "—"} />
        <Row label="Tenure" value={`${app.requestedTenureMonths} months`} />
        <Row label="Interest Rate" value={app.interestRateOffered ? `${app.interestRateOffered}%` : "—"} />
        <Row label="EMI" value={app.emiAmount ? fmt(app.emiAmount) : "—"} />
        <Row label="Purpose" value={app.purpose ?? "—"} />
      </Card>
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Risk</h3>
        <Row label="Risk Score" value={app.riskScore ?? "Not computed"} />
        <Row label="Risk Category" value={app.riskCategory ? <StatusBadge status={app.riskCategory} /> : "—"} />
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px" }}>Eligibility Checks</h3>
        {app.eligibilityChecks?.length ? app.eligibilityChecks.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
            <span>{c.ruleName.replace(/_/g, " ")}</span>
            <span style={{ color: c.passed ? "#10b981" : "#ef4444", fontWeight: 600 }}>{c.passed ? "Pass" : "Fail"}</span>
          </div>
        )) : <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No checks run yet.</p>}
      </Card>
      {app.status === "REJECTED" && (
        <div style={{ gridColumn: "1 / -1" }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Rejection Reason</h3>
              <button onClick={explainRejection} disabled={loadingAi} style={secondaryBtn}><Bot size={14} /> {loadingAi ? "Explaining…" : "AI Explain"}</button>
            </div>
            <p style={{ fontSize: 13, marginTop: 8 }}>{app.rejectionReason ?? "—"}</p>
            {explanation && <p style={{ fontSize: 13, marginTop: 8, padding: 10, background: "var(--bg-base)", borderRadius: 8 }}>{explanation}</p>}
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function DocumentsTab({ app, onChange }: { app: ApplicationDetail; onChange: () => void }) {
  const [docType, setDocType] = useState("PAN_CARD");
  const [fileUrl, setFileUrl] = useState("");

  const upload = async () => {
    if (!fileUrl) return toast.error("Provide a file URL");
    try {
      await api(`/api/lending/applications/${app.id}/documents`, {
        method: "POST",
        body: JSON.stringify({ docType, fileName: fileUrl.split("/").pop() ?? "document", fileUrl, fileSize: 0, mimeType: "application/octet-stream" }),
      });
      setFileUrl("");
      toast.success("Document uploaded");
      onChange();
    } catch (e) { toast.error((e as Error).message); }
  };

  const verify = async (documentId: string, action: "verify" | "reject") => {
    try {
      await api(`/api/lending/applications/${app.id}/documents/${documentId}`, { method: "PATCH", body: JSON.stringify({ action, reason: action === "reject" ? window.prompt("Reason?") ?? "" : undefined }) });
      onChange();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select value={docType} onChange={(e) => setDocType(e.target.value)} style={inputStyle}>
          {["PAN_CARD", "AADHAAR", "GST_CERTIFICATE", "BANK_STATEMENT", "ITR", "FINANCIAL_STATEMENT", "ADDRESS_PROOF", "PHOTO", "OTHER"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <input placeholder="File URL" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={upload} style={primaryBtn}>Upload</button>
      </div>
      {app.documents?.length ? app.documents.map((d) => (
        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{d.docType.replace(/_/g, " ")}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.fileName}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={d.status} />
            {d.status === "PENDING" && (
              <>
                <button onClick={() => verify(d.id, "verify")} style={secondaryBtn}>Verify</button>
                <button onClick={() => verify(d.id, "reject")} style={dangerBtn}>Reject</button>
              </>
            )}
          </div>
        </div>
      )) : <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No documents uploaded yet.</p>}
    </Card>
  );
}

function CollateralTab({ app, onChange }: { app: ApplicationDetail; onChange: () => void }) {
  const [form, setForm] = useState({ type: "PROPERTY", description: "", estimatedValue: "" });

  const add = async () => {
    if (!form.description || !form.estimatedValue) return toast.error("Description and value are required");
    try {
      await api(`/api/lending/applications/${app.id}/collateral`, { method: "POST", body: JSON.stringify({ ...form, estimatedValue: Number(form.estimatedValue) }) });
      setForm({ type: "PROPERTY", description: "", estimatedValue: "" });
      onChange();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={inputStyle}>
          {["PROPERTY", "VEHICLE", "GOLD", "FIXED_DEPOSIT", "INVENTORY", "RECEIVABLES", "EQUIPMENT", "SECURITIES", "OTHER"].map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <input placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
        <input placeholder="Value ₹" type="number" value={form.estimatedValue} onChange={(e) => setForm((f) => ({ ...f, estimatedValue: e.target.value }))} style={inputStyle} />
        <button onClick={add} style={primaryBtn}>Add</button>
      </div>
      {app.collaterals?.length ? app.collaterals.map((c) => (
        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
          <div><p style={{ fontSize: 13, fontWeight: 600 }}>{c.type.replace(/_/g, " ")} — {c.description}</p><p style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmt(c.estimatedValue)}</p></div>
          <StatusBadge status={c.status} />
        </div>
      )) : <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No collateral added.</p>}
    </Card>
  );
}

interface VerificationCaseSummary {
  id: string;
  caseNumber: string;
  status: string;
  _count: { checks: number; documents: number };
}

function VerificationTab({ app }: { app: ApplicationDetail }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const queryKey = ["verification", "cases-for-app", app.id];
  const { data, isLoading } = useQuery<{ cases: VerificationCaseSummary[] }>(queryKey, () =>
    api(`/api/verification/cases?applicationId=${app.id}`)
  );
  const kase = data?.cases?.[0];

  const openCase = async () => {
    setCreating(true);
    try {
      await api("/api/verification/cases", {
        method: "POST",
        body: JSON.stringify({ subjectType: "CUSTOMER", subjectId: app.customer.id, subjectName: app.customer.name, applicationId: app.id }),
      });
      toast.success("Verification case opened");
      qc.invalidate(queryKey);
    } catch (e) { toast.error((e as Error).message); } finally { setCreating(false); }
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Identity, Company, Bank &amp; Background Verification</h3>
        {app.stage === "VERIFICATION" && !kase && (
          <button onClick={openCase} disabled={creating} style={primaryBtn}>{creating ? "Opening…" : "Open Verification Case"}</button>
        )}
      </div>
      {isLoading && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</p>}
      {!isLoading && !kase && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No verification case opened yet for this application.</p>}
      {kase && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{kase.caseNumber}</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{kase._count.checks} check(s) · {kase._count.documents} document(s)</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={kase.status} />
            <Link href={`/verification/cases/${kase.id}`} style={{ color: "#818cf8", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Open Case →</Link>
          </div>
        </div>
      )}
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
        Run PAN/GSTIN/CIN/Aadhaar/bank/IFSC/identity-document/address/phone/email/employment/education/reference checks from the full{" "}
        <Link href="/verification/cases" style={{ color: "#818cf8" }}>case workspace</Link>. The stage only advances once a reviewer explicitly completes the case.
      </p>
    </Card>
  );
}

interface CreditReportRow {
  id: string;
  provider: string;
  pullType: string;
  status: string;
  pulledAt: string | null;
  createdAt: string;
  scores: { score: number; scoreModel: string; riskGrade: string }[];
  tradelines: { id: string; lenderName: string; accountType: string; status: string; currentBalance: string | null; overdueAmount: string | null; dpd: number }[];
  enquiries: { id: string; enquiringInstitution: string; enquiryDate: string }[];
}

function CreditBureauTab({ app, onChange }: { app: ApplicationDetail; onChange: () => void }) {
  const [bureau, setBureau] = useState("CIBIL");
  const [pullType, setPullType] = useState<"SOFT" | "HARD">("SOFT");
  const [pulling, setPulling] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ reports: CreditReportRow[] }>(
    ["lending", "credit-reports", app.id],
    () => api(`/api/credit/reports?applicationId=${app.id}`)
  );

  const pull = async () => {
    setPulling(true);
    try {
      await api("/api/credit/reports", {
        method: "POST",
        body: JSON.stringify({
          subjectType: "CUSTOMER",
          subjectId: app.customer.id,
          subjectName: app.customer.name,
          bureau,
          pullType,
          applicationId: app.id,
        }),
      });
      toast.success(`${bureau} report pulled — Credit Bureau stage complete`);
      onChange();
    } catch (e) { toast.error((e as Error).message); } finally { setPulling(false); }
  };

  const summarize = async (reportId: string) => {
    try {
      const res = await api(`/api/credit/reports/${reportId}/summarize`, { method: "POST" });
      setSummary(res.summary);
    } catch (e) { toast.error((e as Error).message); }
  };

  const latest = data?.reports?.[0];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Pull Credit Report</h3>
        {app.stage === "CREDIT_BUREAU" ? (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <select value={bureau} onChange={(e) => setBureau(e.target.value)} style={inputStyle}>
              {["CIBIL", "EXPERIAN", "CRIF", "EQUIFAX"].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={pullType} onChange={(e) => setPullType(e.target.value as "SOFT" | "HARD")} style={inputStyle}>
              <option value="SOFT">Soft Pull</option>
              <option value="HARD">Hard Pull</option>
            </select>
            <button onClick={pull} disabled={pulling} style={primaryBtn}>{pulling ? "Pulling…" : "Pull Report"}</button>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            {isLoading ? "Loading…" : data?.reports?.length ? "Credit Bureau stage complete." : "No pull recorded for this application."}
          </p>
        )}

        {isLoading && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading reports…</p>}
        {data?.reports?.map((r) => (
          <div key={r.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{r.provider} · {r.pullType}</span>
              <StatusBadge status={r.status} />
            </div>
            {r.scores[0] && (
              <p style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>
                {r.scores[0].score} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>{r.scores[0].scoreModel}</span>
              </p>
            )}
            {r.status === "COMPLETED" && (
              <button onClick={() => summarize(r.id)} style={{ ...secondaryBtn, marginTop: 6 }}><Bot size={13} /> AI Summarize</button>
            )}
          </div>
        ))}
        {summary && <p style={{ fontSize: 13, marginTop: 10, padding: 10, background: "var(--bg-base)", borderRadius: 8 }}>{summary}</p>}
      </Card>

      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Tradelines &amp; Enquiries</h3>
        {latest?.tradelines?.length ? (
          latest.tradelines.map((t) => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 12 }}>
              <span>{t.lenderName} — {t.accountType}</span>
              <span>{fmt(t.currentBalance ?? 0)} {t.dpd > 0 && <span style={{ color: "#ef4444" }}> · {t.dpd}d DPD</span>}</span>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No tradelines on file.</p>
        )}
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px" }}>Recent Enquiries</h3>
        {latest?.enquiries?.length ? (
          latest.enquiries.map((e) => (
            <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--border)", fontSize: 12 }}>
              <span>{e.enquiringInstitution}</span>
              <span style={{ color: "var(--text-muted)" }}>{new Date(e.enquiryDate).toLocaleDateString("en-IN")}</span>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No recent enquiries.</p>
        )}
      </Card>
    </div>
  );
}

interface AMLScreeningRow { id: string; screeningType: string; source: string; matchStatus: string; matchScore: number | null; screenedAt: string }

function AMLTab({ app, onChange }: { app: ApplicationDetail; onChange: () => void }) {
  const [screening, setScreening] = useState(false);

  const { data, isLoading } = useQuery<{ screenings: AMLScreeningRow[] }>(
    ["aml", "screenings", app.customer.id],
    () => api(`/api/aml/screenings?subjectType=CUSTOMER&subjectId=${app.customer.id}`)
  );

  const runScreen = async () => {
    setScreening(true);
    try {
      const result = await api("/api/aml/screenings", {
        method: "POST",
        body: JSON.stringify({ subjectType: "CUSTOMER", subjectId: app.customer.id, subjectName: app.customer.name, applicationId: app.id }),
      });
      if (result.cleared) {
        toast.success("AML screening cleared — no matches found, AML stage complete");
      } else {
        toast.error(`AML screening found ${result.hits.length} hit(s) — case opened for review`);
      }
      onChange();
    } catch (e) { toast.error((e as Error).message); } finally { setScreening(false); }
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>PEP, Sanctions &amp; Negative Media Screening</h3>
        {app.stage === "AML" && <button onClick={runScreen} disabled={screening} style={primaryBtn}>{screening ? "Screening…" : "Run AML Screening"}</button>}
      </div>
      {isLoading && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</p>}
      {!isLoading && (data?.screenings?.length ?? 0) === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No screening run yet for this customer.</p>}
      {data?.screenings?.map((s) => (
        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
          <span>{s.screeningType.replace(/_/g, " ")} · {s.source.replace(/_/g, " ")}{s.matchScore !== null ? ` (${s.matchScore}%)` : ""}</span>
          <StatusBadge status={s.matchStatus} />
        </div>
      ))}
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
        A match opens an AML case for manual review — see the <Link href="/aml/cases" style={{ color: "#818cf8" }}>AML Cases</Link> workspace. The stage only auto-advances when every check clears.
      </p>
    </Card>
  );
}

interface FraudScoreRow { id: string; score: number; riskLevel: string; computedAt: string }

function FraudTab({ app, onChange }: { app: ApplicationDetail; onChange: () => void }) {
  const [screening, setScreening] = useState(false);

  const { data, isLoading } = useQuery<{ scores: FraudScoreRow[] }>(
    ["fraud", "scores", app.customer.id],
    () => api(`/api/fraud/screenings?subjectType=CUSTOMER&subjectId=${app.customer.id}`)
  );

  const runScreen = async () => {
    setScreening(true);
    try {
      const { fingerprint } = await generateDeviceFingerprint();
      const result = await api("/api/fraud/screenings", {
        method: "POST",
        body: JSON.stringify({ subjectType: "CUSTOMER", subjectId: app.customer.id, subjectName: app.customer.name, applicationId: app.id, deviceFingerprint: fingerprint }),
      });
      if (result.cleared) {
        toast.success(`Fraud screening cleared — score ${result.score.score} (${result.score.level}), Fraud stage complete`);
      } else {
        toast.error(`Fraud screening scored ${result.score.score} (${result.score.level}) — case opened for review`);
      }
      onChange();
    } catch (e) { toast.error((e as Error).message); } finally { setScreening(false); }
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Duplicate Identity, Velocity &amp; Rules-Engine Fraud Score</h3>
        {app.stage === "FRAUD" && <button onClick={runScreen} disabled={screening} style={primaryBtn}>{screening ? "Screening…" : "Run Fraud Screening"}</button>}
      </div>
      {isLoading && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</p>}
      {!isLoading && (data?.scores?.length ?? 0) === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No screening run yet for this customer.</p>}
      {data?.scores?.map((s) => (
        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
          <span>Score {s.score}/100</span>
          <StatusBadge status={s.riskLevel} />
        </div>
      ))}
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
        Includes a real browser device fingerprint captured just now. A HIGH/CRITICAL score or blacklist hit opens a <Link href="/fraud/cases" style={{ color: "#818cf8" }}>Fraud Case</Link> for manual review instead of auto-advancing.
      </p>
    </Card>
  );
}

function ApprovalTab({ app, onDecide }: { app: ApplicationDetail; onDecide: (stepId: string, d: "APPROVED" | "REJECTED") => void }) {
  return (
    <Card>
      {app.approvalSteps?.length ? app.approvalSteps.map((s) => (
        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Level {s.level} — {s.approverRole}</p>
            {s.comments && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.comments}</p>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={s.status} />
            {s.status === "PENDING" && app.stage === "APPROVAL_MATRIX" && (
              <>
                <button onClick={() => onDecide(s.id, "APPROVED")} style={primaryBtn}>Approve</button>
                <button onClick={() => onDecide(s.id, "REJECTED")} style={dangerBtn}>Reject</button>
              </>
            )}
          </div>
        </div>
      )) : <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Approval steps appear once the risk score is computed.</p>}
    </Card>
  );
}

function LettersTab({ app, onChange }: { app: ApplicationDetail; onChange: () => void }) {
  const issueLetter = async (type: string) => {
    try { await api(`/api/lending/applications/${app.id}/letters`, { method: "POST", body: JSON.stringify({ type }) }); toast.success(`${type.replace(/_/g, " ")} issued`); onChange(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const createAgreement = async () => {
    try { await api(`/api/lending/applications/${app.id}/agreements`, { method: "POST" }); toast.success("Agreement drafted"); onChange(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const sendAgreement = async (agreementId: string) => {
    try { await api(`/api/lending/applications/${app.id}/agreements/${agreementId}`, { method: "PATCH", body: JSON.stringify({ action: "send" }) }); toast.success("Sent for signature"); onChange(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const syncAgreement = async (agreementId: string) => {
    try { await api(`/api/lending/applications/${app.id}/agreements/${agreementId}`, { method: "PATCH", body: JSON.stringify({ action: "sync" }) }); toast.success("Signature status refreshed"); onChange(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Letters</h3>
        {(app.status === "APPROVED" || app.status === "SANCTIONED") && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={() => issueLetter("SANCTION_LETTER")} style={primaryBtn}>Issue Sanction Letter</button>
            <button onClick={() => issueLetter("OFFER_LETTER")} style={secondaryBtn}>Issue Offer Letter</button>
          </div>
        )}
        {app.generatedLetters?.length ? app.generatedLetters.map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
            <span>{l.type.replace(/_/g, " ")} v{l.version}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <StatusBadge status={l.status} />
              <a href={`/api/lending/applications/${app.id}/letters/${l.id}/pdf?disposition=inline`} target="_blank" rel="noreferrer" style={{ color: "#818cf8" }}>View PDF</a>
            </div>
          </div>
        )) : <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No letters issued yet.</p>}
      </Card>
      <Card>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Loan Agreement</h3>
        {app.stage === "AGREEMENT" && !app.agreements?.length && <button onClick={createAgreement} style={primaryBtn}>Draft Agreement</button>}
        {app.agreements?.map((a) => (
          <div key={a.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>v{a.version}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <StatusBadge status={a.status} />
                <a href={`/api/lending/applications/${app.id}/agreements/${a.id}/pdf?disposition=inline`} target="_blank" rel="noreferrer" style={{ color: "#818cf8", fontSize: 12 }}>PDF</a>
              </div>
            </div>
            <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
              {a.status === "DRAFT" && <button onClick={() => sendAgreement(a.id)} style={secondaryBtn}>Send for Signature</button>}
              {["SENT_FOR_SIGNATURE", "PARTIALLY_SIGNED"].includes(a.status) && <button onClick={() => syncAgreement(a.id)} style={secondaryBtn}>Refresh Signature Status</button>}
            </div>
            {a.signatories?.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                <span>{s.role} — {s.name}</span><span>{s.status}</span>
              </div>
            ))}
          </div>
        ))}
      </Card>
    </div>
  );
}

function DisbursementTab({ app, onChange }: { app: ApplicationDetail; onChange: () => void }) {
  const [form, setForm] = useState({ bankAccountId: "", mode: "NEFT", beneficiaryAccountNumber: "", beneficiaryIfsc: "" });

  const initiate = async () => {
    try {
      await api(`/api/lending/applications/${app.id}/disbursement`, { method: "POST", body: JSON.stringify(form) });
      toast.success("Disbursement initiated — polling gateway for confirmation");
      onChange();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      {app.stage === "DISBURSEMENT" && !app.disbursements?.some((d) => d.status === "COMPLETED") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <input placeholder="Source Bank Account ID" value={form.bankAccountId} onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))} style={inputStyle} />
          <select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} style={inputStyle}>
            {["NEFT", "RTGS", "IMPS", "UPI"].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input placeholder="Beneficiary Account Number" value={form.beneficiaryAccountNumber} onChange={(e) => setForm((f) => ({ ...f, beneficiaryAccountNumber: e.target.value }))} style={inputStyle} />
          <input placeholder="Beneficiary IFSC" value={form.beneficiaryIfsc} onChange={(e) => setForm((f) => ({ ...f, beneficiaryIfsc: e.target.value }))} style={inputStyle} />
          <button onClick={initiate} style={{ ...primaryBtn, gridColumn: "1 / -1" }}>Initiate Disbursement</button>
        </div>
      )}
      {app.disbursements?.length ? app.disbursements.map((d) => (
        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
          <span>{fmt(d.amount)} · {d.mode}</span>
          <StatusBadge status={d.status} />
        </div>
      )) : <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No disbursement initiated yet.</p>}
    </Card>
  );
}

function HistoryTab({ id }: { id: string }) {
  const { data } = useQuery<{ history: HistoryEntry[] }>(["lending", "application-history", id], () => api(`/api/lending/applications/${id}/history`));
  return (
    <Card>
      {data?.history?.length ? data.history.map((h) => (
        <div key={h.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600 }}>{h.event.replace(/_/g, " ")}</span>
            <span style={{ color: "var(--text-muted)" }}>{new Date(h.createdAt).toLocaleString("en-IN")}</span>
          </div>
          {h.detail && <p style={{ color: "var(--text-muted)", marginTop: 2 }}>{h.detail}</p>}
        </div>
      )) : <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No history yet.</p>}
    </Card>
  );
}

const inputStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)" };
const primaryBtn: React.CSSProperties = { padding: "8px 14px", background: "#6366f1", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
const secondaryBtn: React.CSSProperties = { padding: "8px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
const dangerBtn: React.CSSProperties = { padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#ef4444", cursor: "pointer" };
