"use client";

// ============================================================
// /erp/purchases/[id] — Bill detail + Pay Bill (TBX Payments,
// Phase 2D). Payments attach to Purchase (Accounts Payable), never
// to Invoice (Accounts Receivable) — see architecture decision.
// Mirrors the crm/[id] / vendors/[id] detail-page pattern.
// ============================================================

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader, CreditCard, X, Landmark, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";

interface PurchaseItemRow {
  id: string;
  description: string;
  quantity: string | number;
  unitCost: string | number;
  amount: string | number;
}

interface VendorPaymentRow {
  id: string;
  amount: string | number;
  paymentType: string;
  status: string;
  tbxUtr: string | null;
  failureReason: string | null;
  rejectionReason: string | null;
  createdAt: string;
  bankAccount: { accountName: string; bankName: string } | null;
  maker: { name: string } | null;
  checker: { name: string } | null;
}

interface VendorInfo {
  id: string;
  name: string;
  tbxBeneficiaryId: string | null;
  tbxBeneficiaryStatus: string;
  tbxApprovalStatus: string;
}

interface PurchaseData {
  id: string;
  purchaseNumber: string;
  vendorName: string | null;
  totalAmount: string | number;
  status: string;
  paymentStatus: "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";
  purchaseDate: string;
  notes: string | null;
  vendor: VendorInfo | null;
  items: PurchaseItemRow[];
  vendorPayments: VendorPaymentRow[];
}

interface BankAccountOption {
  id: string;
  accountName: string;
  bankName: string;
  maskedNumber: string | null;
}

const paymentStatusMeta: Record<PurchaseData["paymentStatus"], { color: string; bg: string }> = {
  PENDING: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  PAID: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  OVERDUE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  PARTIAL: { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" },
};

const vendorPaymentStatusMeta: Record<string, { color: string; bg: string }> = {
  DRAFT: { color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  MAKER_PENDING: { color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  CHECKER_PENDING: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  SUBMITTED: { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" },
  PROCESSING: { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" },
  SUCCESS: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  FAILED: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  CANCELLED: { color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

function inr(n: unknown) {
  return `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function PayBillModal({ purchase, outstanding, onClose, onSuccess }: { purchase: PurchaseData; outstanding: number; onClose: () => void; onSuccess: () => void }) {
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentType, setPaymentType] = useState<"NEFT" | "RTGS" | "IMPS">("NEFT");
  const [amount, setAmount] = useState(String(outstanding));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/banking/accounts")
      .then((r) => r.json())
      .then((d) => {
        const accounts: BankAccountOption[] = d.accounts ?? [];
        setBankAccounts(accounts);
        if (accounts.length > 0) setBankAccountId(accounts[0].id);
      })
      .catch(() => toast.error("Failed to load bank accounts"));
  }, []);

  const handleSubmit = async () => {
    if (!bankAccountId) return toast.error("Select a bank account to pay from");
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");

    setSubmitting(true);
    try {
      const createRes = await fetch("/api/banking/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: purchase.id, bankAccountId, amount: amt, paymentType }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created?.error ?? "Failed to create payment");

      const submitRes = await fetch(`/api/banking/payments/${created.id}/submit`, { method: "POST" });
      const submitted = await submitRes.json();
      if (!submitRes.ok) throw new Error(submitted?.error ?? "Failed to submit payment for approval");

      toast.success("Payment submitted for checker approval");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="surface" style={{ padding: 24, width: 420, maxWidth: "90vw" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 className="section-title" style={{ fontSize: 16 }}>Pay Bill {purchase.purchaseNumber}</h3>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 6 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Payment Type</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["NEFT", "RTGS", "IMPS"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPaymentType(t)}
                  className={paymentType === t ? "btn-primary" : "btn-ghost"}
                  style={{ flex: 1, padding: "8px 0", fontSize: 12.5 }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Pay From</p>
            <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="input" style={{ width: "100%" }}>
              {bankAccounts.length === 0 && <option value="">No bank accounts found</option>}
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountName} — {a.bankName} {a.maskedNumber ? `(${a.maskedNumber})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Amount (outstanding: {inr(outstanding)})</p>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" style={{ width: "100%" }} max={outstanding} min={0} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(99,102,241,0.08)" }}>
            <Landmark size={13} color="#818cf8" />
            <p style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
              Beneficiary: {purchase.vendor?.name} · TBX ID {purchase.vendor?.tbxBeneficiaryId}
            </p>
          </div>

          <button onClick={handleSubmit} disabled={submitting} className="btn-primary" style={{ padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {submitting ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CreditCard size={14} />}
            Submit for Approval
          </button>
        </div>
      </motion.div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const purchaseId = params.id as string;

  const [purchase, setPurchase] = useState<PurchaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);

  const fetchPurchase = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/erp/purchases/${purchaseId}`);
      if (res.status === 404) throw new Error("Bill not found");
      if (!res.ok) throw new Error("Failed to fetch bill");
      setPurchase(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  if (loading) {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <Loader size={24} style={{ animation: "spin 1s linear infinite" }} color="var(--text-muted)" />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="page-container">
        <div className="surface" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 8 }}>{error ?? "Bill not found"}</p>
          <button onClick={() => router.push("/erp/purchases")} className="btn-ghost" style={{ display: "inline-flex", padding: "8px 14px" }}>
            <ArrowLeft size={14} /> Back to Purchases
          </button>
        </div>
      </div>
    );
  }

  const successfulPaid = purchase.vendorPayments.filter((p) => p.status === "SUCCESS").reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = Math.max(0, Number(purchase.totalAmount) - successfulPaid);
  const hasInFlightPayment = purchase.vendorPayments.some((p) => !["SUCCESS", "FAILED", "CANCELLED"].includes(p.status));
  const vendorReady = purchase.vendor?.tbxBeneficiaryStatus === "ACTIVE" && purchase.vendor?.tbxApprovalStatus === "APPROVED";
  const psMeta = paymentStatusMeta[purchase.paymentStatus];

  return (
    <div className="page-container animate-fade-in">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => router.push("/erp/purchases")} className="btn-ghost" style={{ padding: 8 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="section-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {purchase.purchaseNumber}
              <span className="badge" style={{ background: psMeta.bg, color: psMeta.color, border: "none", fontSize: 10 }}>{purchase.paymentStatus}</span>
            </h1>
            <p className="section-subtitle">
              {purchase.vendor ? <Link href={`/erp/vendors/${purchase.vendor.id}`}>{purchase.vendor.name}</Link> : purchase.vendorName ?? "No vendor"} · {format(new Date(purchase.purchaseDate), "dd MMM yyyy")}
            </p>
          </div>
        </div>
        {outstanding > 0 && !hasInFlightPayment && (
          <button
            onClick={() => (vendorReady ? setShowPayModal(true) : toast.error("Vendor is not an approved TBX beneficiary yet"))}
            className="btn-primary"
            style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, opacity: vendorReady ? 1 : 0.6 }}
          >
            <CreditCard size={14} /> Pay Bill
          </button>
        )}
      </motion.div>

      {!vendorReady && outstanding > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", marginBottom: 20 }}>
          <ShieldAlert size={14} color="#f59e0b" />
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            {purchase.vendor ? (
              <>Vendor <Link href={`/erp/vendors/${purchase.vendor.id}`} style={{ color: "#f59e0b" }}>{purchase.vendor.name}</Link> is not an approved TBX beneficiary yet — complete beneficiary onboarding before paying this bill via TBX.</>
            ) : (
              "This bill has no linked vendor record, so it cannot be paid via TBX."
            )}
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="stat-card"><p style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Amount</p><p style={{ fontSize: 20, fontWeight: 700 }}>{inr(purchase.totalAmount)}</p></div>
        <div className="stat-card"><p style={{ fontSize: 11, color: "var(--text-muted)" }}>Paid</p><p style={{ fontSize: 20, fontWeight: 700, color: "#10b981" }}>{inr(successfulPaid)}</p></div>
        <div className="stat-card"><p style={{ fontSize: 11, color: "var(--text-muted)" }}>Outstanding</p><p style={{ fontSize: 20, fontWeight: 700, color: outstanding > 0 ? "#f59e0b" : "#10b981" }}>{inr(outstanding)}</p></div>
      </div>

      {/* Line items */}
      <motion.div className="surface" style={{ padding: 24, marginBottom: 24 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="section-title" style={{ marginBottom: 16, fontSize: 15 }}>Line Items</h2>
        <table className="data-table">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit Cost</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            {purchase.items.map((it) => (
              <tr key={it.id}>
                <td style={{ fontSize: 13 }}>{it.description}</td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{it.quantity}</td>
                <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{inr(it.unitCost)}</td>
                <td style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>{inr(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* TBX Payments */}
      <motion.div className="surface" style={{ padding: 24 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <h2 className="section-title" style={{ marginBottom: 16, fontSize: 15 }}>TBX Payments</h2>
        {purchase.vendorPayments.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No payment attempts yet.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>From</th><th>Maker</th><th>Checker</th><th>Status</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>
              {purchase.vendorPayments.map((p) => {
                const meta = vendorPaymentStatusMeta[p.status] ?? vendorPaymentStatusMeta.DRAFT;
                return (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{format(new Date(p.createdAt), "dd MMM, HH:mm")}</td>
                    <td style={{ fontSize: 12 }}>{p.paymentType}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.bankAccount?.accountName ?? "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.maker?.name ?? "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.checker?.name ?? "—"}</td>
                    <td>
                      <span className="badge" style={{ background: meta.bg, color: meta.color, border: "none", fontSize: 10 }}>{p.status}</span>
                      {p.failureReason && <p style={{ fontSize: 10.5, color: "#ef4444", marginTop: 2 }}>{p.failureReason}</p>}
                      {p.rejectionReason && <p style={{ fontSize: 10.5, color: "#ef4444", marginTop: 2 }}>{p.rejectionReason}</p>}
                      {p.tbxUtr && <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>UTR {p.tbxUtr}</p>}
                    </td>
                    <td style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>{inr(p.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>

      {showPayModal && (
        <PayBillModal purchase={purchase} outstanding={outstanding} onClose={() => setShowPayModal(false)} onSuccess={fetchPurchase} />
      )}
    </div>
  );
}
