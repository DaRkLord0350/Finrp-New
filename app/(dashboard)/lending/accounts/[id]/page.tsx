"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@/lib/queryCache";
import { StatusBadge } from "@/components/ui/status-badge";

interface EmiRow { id: string; installmentNumber: number; dueDate: string; totalDue: string; outstandingPrincipal: string; status: string }
interface RepaymentRow { id: string; amount: string; method: string; status: string }
interface AccountDetail {
  id: string;
  accountNumber: string;
  status: string;
  principalDisbursed: string;
  currentOutstandingPrincipal: string;
  interestRate: string;
  nextDueDate: string | null;
  nextDueAmount: string | null;
  mandateStatus: string | null;
  mandateType: string | null;
  mandateReferenceId: string | null;
  customer: { name: string };
  product: { name: string };
  emiSchedules: EmiRow[];
  repayments: RepaymentRow[];
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

export default function LoanAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ account: AccountDetail }>(["lending", "account", id], () => api(`/api/lending/accounts/${id}`));
  const refresh = () => qc.invalidate(["lending", "account", id]);

  const [mandate, setMandate] = useState({ mandateType: "NACH", payerName: "", payerAccountNumber: "", payerIfsc: "", maxAmountPerDebit: "" });
  const [manualPayment, setManualPayment] = useState({ amount: "", method: "MANUAL" as const });
  const [partPayment, setPartPayment] = useState("");

  if (isLoading || !data) return <p style={{ color: "var(--text-muted)" }}>Loading loan account…</p>;
  const account = data.account;

  const registerMandate = async () => {
    try {
      await api(`/api/lending/accounts/${id}/mandate`, { method: "POST", body: JSON.stringify({ ...mandate, maxAmountPerDebit: Number(mandate.maxAmountPerDebit) }) });
      toast.success("Auto-debit mandate registered");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const recordPayment = async () => {
    try {
      await api(`/api/lending/accounts/${id}/repayments`, { method: "POST", body: JSON.stringify({ amount: Number(manualPayment.amount), method: manualPayment.method }) });
      toast.success("Repayment recorded");
      setManualPayment({ amount: "", method: "MANUAL" });
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doPartPayment = async () => {
    try {
      await api(`/api/lending/accounts/${id}/part-payment`, { method: "POST", body: JSON.stringify({ amount: Number(partPayment) }) });
      toast.success("Part payment applied — schedule regenerated");
      setPartPayment("");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const doForeclosure = async () => {
    if (!window.confirm("Request foreclosure for this loan account?")) return;
    try {
      await api(`/api/lending/accounts/${id}/foreclosure`, { method: "POST" });
      toast.success("Foreclosure requested — awaiting approval");
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{account.accountNumber}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{account.customer.name} · {account.product.name}</p>
        </div>
        <StatusBadge status={account.status} size="md" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <Stat label="Principal Disbursed" value={fmt(account.principalDisbursed)} />
        <Stat label="Outstanding" value={fmt(account.currentOutstandingPrincipal)} />
        <Stat label="Next Due" value={account.nextDueDate ? `${fmt(account.nextDueAmount)} on ${new Date(account.nextDueDate).toLocaleDateString("en-IN")}` : "—"} />
        <Stat label="Interest Rate" value={`${account.interestRate}%`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card title="EMI Schedule">
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-muted)", position: "sticky", top: 0, background: "var(--bg-surface)" }}>
                  <th style={{ padding: "6px 8px" }}>#</th>
                  <th style={{ padding: "6px 8px" }}>Due Date</th>
                  <th style={{ padding: "6px 8px" }}>EMI</th>
                  <th style={{ padding: "6px 8px" }}>Outstanding</th>
                  <th style={{ padding: "6px 8px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {account.emiSchedules?.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px" }}>{e.installmentNumber}</td>
                    <td style={{ padding: "6px 8px" }}>{new Date(e.dueDate).toLocaleDateString("en-IN")}</td>
                    <td style={{ padding: "6px 8px" }}>{fmt(e.totalDue)}</td>
                    <td style={{ padding: "6px 8px" }}>{fmt(e.outstandingPrincipal)}</td>
                    <td style={{ padding: "6px 8px" }}><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Repayments">
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input placeholder="Amount ₹" type="number" value={manualPayment.amount} onChange={(e) => setManualPayment((p) => ({ ...p, amount: e.target.value }))} style={inputStyle} />
            <select value={manualPayment.method} onChange={(e) => setManualPayment((p) => ({ ...p, method: e.target.value as "MANUAL" }))} style={inputStyle}>
              {["MANUAL", "BANK_TRANSFER", "CASH", "CHEQUE"].map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
            </select>
            <button onClick={recordPayment} style={primaryBtn}>Record</button>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {account.repayments?.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
                <span>{fmt(r.amount)} · {r.method.replace(/_/g, " ")}</span>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Auto-Debit Mandate (NACH / UPI AutoPay)">
          {account.mandateStatus === "ACTIVE" ? (
            <p style={{ fontSize: 13 }}>Active mandate: {account.mandateType} ({account.mandateReferenceId})</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <select value={mandate.mandateType} onChange={(e) => setMandate((m) => ({ ...m, mandateType: e.target.value }))} style={inputStyle}>
                <option value="NACH">NACH</option>
                <option value="UPI_AUTOPAY">UPI AutoPay</option>
              </select>
              <input placeholder="Payer Name" value={mandate.payerName} onChange={(e) => setMandate((m) => ({ ...m, payerName: e.target.value }))} style={inputStyle} />
              {mandate.mandateType === "NACH" ? (
                <>
                  <input placeholder="Account Number" value={mandate.payerAccountNumber} onChange={(e) => setMandate((m) => ({ ...m, payerAccountNumber: e.target.value }))} style={inputStyle} />
                  <input placeholder="IFSC" value={mandate.payerIfsc} onChange={(e) => setMandate((m) => ({ ...m, payerIfsc: e.target.value }))} style={inputStyle} />
                </>
              ) : (
                <input placeholder="UPI VPA" onChange={() => {}} style={inputStyle} />
              )}
              <input placeholder="Max Amount per Debit ₹" type="number" value={mandate.maxAmountPerDebit} onChange={(e) => setMandate((m) => ({ ...m, maxAmountPerDebit: e.target.value }))} style={inputStyle} />
              <button onClick={registerMandate} style={primaryBtn}>Register Mandate</button>
            </div>
          )}
        </Card>

        <Card title="Foreclosure & Part Payment">
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input placeholder="Part-payment amount ₹" type="number" value={partPayment} onChange={(e) => setPartPayment(e.target.value)} style={inputStyle} />
            <button onClick={doPartPayment} style={secondaryBtn}>Apply</button>
          </div>
          <button onClick={doForeclosure} style={dangerBtn}>Request Foreclosure</button>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 17, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: "var(--text-primary)" };
const primaryBtn: React.CSSProperties = { padding: "8px 14px", background: "#6366f1", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" };
const secondaryBtn: React.CSSProperties = { padding: "8px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" };
const dangerBtn: React.CSSProperties = { padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#ef4444", cursor: "pointer" };
