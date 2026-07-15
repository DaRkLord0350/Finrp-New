"use client";

// ============================================================
// /erp/vendors/[id] — Vendor detail + TBX Beneficiary card.
// Vendor is the source of truth for TBX beneficiary state (Phase
// 2C) — there is no separate beneficiary master. Mirrors the
// crm/[id] detail-page pattern (profile/stats card grid, full-width
// section cards below).
// ============================================================

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, Landmark, Edit, Save, X,
  Loader, ShieldCheck, ShieldAlert, ShieldQuestion, RefreshCw, Link2, FileJson,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";

interface VendorPurchase {
  id: string;
  purchaseNumber: string;
  totalAmount: string | number;
  status: string;
  paymentStatus: string;
  purchaseDate: string;
}

interface VendorData {
  id: string;
  name: string;
  vendorCode: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  gstin: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankIFSC: string | null;
  outstandingBalance: string | number;
  totalPurchases: string | number;
  paymentTermsDays: number;
  isActive: boolean;
  tbxBeneficiaryId: string | null;
  tbxBeneficiaryStatus: "NOT_LINKED" | "PENDING" | "ACTIVE" | "INACTIVE" | "FAILED";
  tbxVerificationStatus: "NOT_STARTED" | "PENDING" | "IN_PROGRESS" | "VERIFIED" | "FAILED" | "EXPIRED";
  tbxApprovalStatus: "NOT_REQUESTED" | "PENDING" | "APPROVED" | "REJECTED";
  tbxLastSyncAt: string | null;
  tbxMetadata: unknown;
  purchases?: VendorPurchase[];
}

type EditableFields = Pick<
  VendorData,
  "name" | "contactPerson" | "email" | "phone" | "address" | "city" | "state" | "gstin" | "bankName" | "bankAccount" | "bankIFSC"
>;

const labelText = { fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 };

const beneficiaryMeta: Record<VendorData["tbxBeneficiaryStatus"], { color: string; bg: string; label: string }> = {
  NOT_LINKED: { color: "#64748b", bg: "rgba(100,116,139,0.12)", label: "Not Linked" },
  PENDING:    { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Pending" },
  ACTIVE:     { color: "#10b981", bg: "rgba(16,185,129,0.12)", label: "TBX Linked" },
  INACTIVE:   { color: "#64748b", bg: "rgba(100,116,139,0.12)", label: "Inactive" },
  FAILED:     { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "Failed" },
};

const verificationMeta: Record<VendorData["tbxVerificationStatus"], { color: string; label: string }> = {
  NOT_STARTED: { color: "#64748b", label: "Not Started" },
  PENDING:     { color: "#f59e0b", label: "Pending" },
  IN_PROGRESS: { color: "#0ea5e9", label: "In Progress" },
  VERIFIED:    { color: "#10b981", label: "Verified" },
  FAILED:      { color: "#ef4444", label: "Failed" },
  EXPIRED:     { color: "#ef4444", label: "Expired" },
};

const approvalMeta: Record<VendorData["tbxApprovalStatus"], { color: string; label: string }> = {
  NOT_REQUESTED: { color: "#64748b", label: "Not Requested" },
  PENDING:       { color: "#f59e0b", label: "Pending" },
  APPROVED:      { color: "#10b981", label: "Approved" },
  REJECTED:      { color: "#ef4444", label: "Rejected" },
};

const statusPillStyle: Record<string, { color: string; bg: string }> = {
  ORDERED: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  RECEIVED: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  PAID: { color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  PENDING: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  OVERDUE: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<EditableFields>>({});
  const [actionBusy, setActionBusy] = useState<"create" | "verify" | "sync" | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetchVendor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const fetchVendor = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/erp/vendors/${vendorId}`);
      if (res.status === 404) throw new Error("Vendor not found");
      if (!res.ok) throw new Error("Failed to fetch vendor");
      const data = (await res.json()) as VendorData;
      setVendor(data);
      setFormData({
        name: data.name,
        contactPerson: data.contactPerson,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        gstin: data.gstin,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        bankIFSC: data.bankIFSC,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!vendor) return;
    try {
      const res = await fetch(`/api/erp/vendors/${vendorId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to update vendor");
      setIsEditing(false);
      toast.success("Vendor updated");
      await fetchVendor();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update vendor");
    }
  };

  const runBeneficiaryAction = async (action: "create" | "verify" | "sync") => {
    setActionBusy(action);
    try {
      const res = await fetch(`/api/banking/beneficiaries/${vendorId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "sync" ? JSON.stringify({}) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Failed to ${action} beneficiary`);
      toast.success(`Beneficiary ${action} queued — refreshing shortly`);
      // TBX actions run through Inngest; give the background job a moment
      // before refetching so the status update has landed.
      setTimeout(fetchVendor, 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} beneficiary`);
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <Loader size={24} style={{ animation: "spin 1s linear infinite" }} color="var(--text-muted)" />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="page-container">
        <div className="surface" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 8 }}>{error ?? "Vendor not found"}</p>
          <Link href="/erp/vendors" className="btn-ghost" style={{ display: "inline-flex", padding: "8px 14px" }}>
            <ArrowLeft size={14} /> Back to Vendors
          </Link>
        </div>
      </div>
    );
  }

  const bMeta = beneficiaryMeta[vendor.tbxBeneficiaryStatus];
  const vMeta = verificationMeta[vendor.tbxVerificationStatus];
  const aMeta = approvalMeta[vendor.tbxApprovalStatus];
  const canCreate = vendor.tbxBeneficiaryStatus === "NOT_LINKED" || vendor.tbxBeneficiaryStatus === "FAILED";
  const hasBankDetails = Boolean(vendor.bankAccount && vendor.bankIFSC);
  const hasBeneficiary = Boolean(vendor.tbxBeneficiaryId);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => router.push("/erp/vendors")} className="btn-ghost" style={{ padding: 8 }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="section-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {vendor.name}
              <span className="badge" style={{ background: bMeta.bg, color: bMeta.color, border: "none", fontSize: 10 }}>
                {bMeta.label}
              </span>
            </h1>
            <p className="section-subtitle">{vendor.vendorCode ?? vendor.gstin ?? "Vendor"}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isEditing ? (
            <>
              <button onClick={handleUpdate} className="btn-primary" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <Save size={14} /> Save
              </button>
              <button onClick={() => setIsEditing(false)} className="btn-ghost" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <X size={14} /> Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="btn-ghost" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
              <Edit size={14} /> Edit
            </button>
          )}
        </div>
      </motion.div>

      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        {/* Profile card */}
        <motion.div className="surface" style={{ padding: 24 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="section-title" style={{ marginBottom: 16, fontSize: 15 }}>Profile</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Mail size={14} color="var(--text-muted)" />
              {isEditing ? (
                <input value={formData.email ?? ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" placeholder="Email" style={{ flex: 1 }} />
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{vendor.email ?? "—"}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Phone size={14} color="var(--text-muted)" />
              {isEditing ? (
                <input value={formData.phone ?? ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input" placeholder="Phone" style={{ flex: 1 }} />
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{vendor.phone ?? "—"}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MapPin size={14} color="var(--text-muted)" />
              {isEditing ? (
                <input value={formData.address ?? ""} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input" placeholder="Address" style={{ flex: 1 }} />
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{[vendor.address, vendor.city, vendor.state].filter(Boolean).join(", ") || "—"}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Building2 size={14} color="var(--text-muted)" />
              {isEditing ? (
                <input value={formData.gstin ?? ""} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} className="input" placeholder="GSTIN" style={{ flex: 1 }} />
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{vendor.gstin ?? "—"}</span>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
              <p style={labelText}>Bank Details (used for TBX beneficiary)</p>
              {isEditing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  <input value={formData.bankName ?? ""} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} className="input" placeholder="Bank name" />
                  <input value={formData.bankAccount ?? ""} onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })} className="input" placeholder="Account number" />
                  <input value={formData.bankIFSC ?? ""} onChange={(e) => setFormData({ ...formData, bankIFSC: e.target.value })} className="input" placeholder="IFSC code" />
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <Landmark size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {vendor.bankName ?? "—"} {vendor.bankAccount ? `· •••• ${vendor.bankAccount.slice(-4)}` : ""} {vendor.bankIFSC ? `· ${vendor.bankIFSC}` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats card */}
        <motion.div className="surface" style={{ padding: 24 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h2 className="section-title" style={{ marginBottom: 16, fontSize: 15 }}>Account Overview</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
              <p style={labelText}>Outstanding</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                ₹{Number(vendor.outstandingBalance).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
              <p style={labelText}>Total Purchases</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                ₹{Number(vendor.totalPurchases).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
              <p style={labelText}>Payment Terms</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{vendor.paymentTermsDays} days</p>
            </div>
            <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
              <p style={labelText}>Status</p>
              <p style={{ fontSize: 13, color: vendor.isActive ? "#10b981" : "#64748b" }}>{vendor.isActive ? "Active" : "Inactive"}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* TBX Beneficiary card */}
      <motion.div className="surface" style={{ padding: 24, marginBottom: 24 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Landmark size={16} color="#818cf8" />
            <h2 className="section-title" style={{ fontSize: 15 }}>TBX Beneficiary</h2>
          </div>
          <span className="badge" style={{ background: bMeta.bg, color: bMeta.color, border: "none", fontSize: 11 }}>
            {hasBeneficiary ? "TBX Linked" : "Not Linked"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
          <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
            <p style={labelText}>Beneficiary ID</p>
            <p style={{ fontSize: 13, fontFamily: "monospace", color: "var(--text-secondary)" }}>{vendor.tbxBeneficiaryId ?? "—"}</p>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
            <p style={labelText}>Verification</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: vMeta.color, display: "flex", alignItems: "center", gap: 6 }}>
              {vendor.tbxVerificationStatus === "VERIFIED" ? <ShieldCheck size={13} /> : vendor.tbxVerificationStatus === "FAILED" || vendor.tbxVerificationStatus === "EXPIRED" ? <ShieldAlert size={13} /> : <ShieldQuestion size={13} />}
              {vMeta.label}
            </p>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
            <p style={labelText}>Approval</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: aMeta.color }}>{aMeta.label}</p>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: 8, padding: 12 }}>
            <p style={labelText}>Last Sync</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {vendor.tbxLastSyncAt ? format(new Date(vendor.tbxLastSyncAt), "dd MMM yyyy, HH:mm") : "Never"}
            </p>
          </div>
        </div>

        {!hasBankDetails && canCreate && (
          <p style={{ fontSize: 12, color: "#f59e0b", marginBottom: 12 }}>
            Add a bank account number and IFSC code above before creating a TBX beneficiary.
          </p>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canCreate && (
            <button
              onClick={() => runBeneficiaryAction("create")}
              disabled={!hasBankDetails || actionBusy !== null}
              className="btn-primary"
              style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, opacity: !hasBankDetails ? 0.5 : 1 }}
            >
              {actionBusy === "create" ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Link2 size={14} />}
              Create Beneficiary
            </button>
          )}
          {hasBeneficiary && (
            <button
              onClick={() => runBeneficiaryAction("verify")}
              disabled={actionBusy !== null}
              className="btn-ghost"
              style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}
            >
              {actionBusy === "verify" ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <ShieldCheck size={14} />}
              Verify Beneficiary
            </button>
          )}
          {hasBeneficiary && (
            <button
              onClick={() => runBeneficiaryAction("sync")}
              disabled={actionBusy !== null}
              className="btn-ghost"
              style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}
            >
              {actionBusy === "sync" ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
              Sync
            </button>
          )}
          {hasBeneficiary && (
            <button onClick={() => setShowRaw((v) => !v)} className="btn-ghost" style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
              <FileJson size={14} />
              {showRaw ? "Hide Details" : "View Details"}
            </button>
          )}
        </div>

        {showRaw && (
          <pre
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 8,
              background: "var(--bg-elevated)",
              fontSize: 11.5,
              color: "var(--text-secondary)",
              overflow: "auto",
              maxHeight: 240,
            }}
          >
            {JSON.stringify(vendor.tbxMetadata ?? {}, null, 2)}
          </pre>
        )}
      </motion.div>

      {/* Purchase History */}
      <motion.div className="surface" style={{ padding: 24 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <h2 className="section-title" style={{ marginBottom: 16, fontSize: 15 }}>Purchase History</h2>
        {!vendor.purchases || vendor.purchases.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No bills recorded for this vendor yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {vendor.purchases.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/erp/purchases/${p.id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {p.purchaseNumber}
                      </Link>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{format(new Date(p.purchaseDate), "dd MMM yyyy")}</td>
                    <td>
                      <span className="badge" style={{ background: statusPillStyle[p.status]?.bg, color: statusPillStyle[p.status]?.color, border: "none", fontSize: 10 }}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ background: statusPillStyle[p.paymentStatus]?.bg, color: statusPillStyle[p.paymentStatus]?.color, border: "none", fontSize: 10 }}>
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      ₹{Number(p.totalAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
