"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Download,
  Printer,
  CreditCard,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  Mail,
  Share2,
  Copy,
  FileMinus,
  Pencil,
  User,
  Calendar,
  PanelLeft,
  History,
  Repeat,
} from "lucide-react";
import { formatCurrency, formatCompactCurrency } from "@/lib/formatters/currency";
import { formatDate, formatDateTime } from "@/lib/formatters/date";
import InvoiceStatusSelect from "@/components/InvoiceStatusSelect";
import { getInvoiceStatusMeta } from "@/lib/invoice-status";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import InvoiceListSidebar from "@/components/billing/InvoiceListSidebar";
import InvoiceActivityTimeline from "@/components/billing/InvoiceActivityTimeline";
import RecordPaymentModal from "@/components/billing/RecordPaymentModal";
import SendEmailModal from "@/components/billing/SendEmailModal";
import ShareModal from "@/components/billing/ShareModal";
import VersionHistoryModal from "@/components/billing/VersionHistoryModal";
import CreditNoteModal from "@/components/billing/CreditNoteModal";
import MakeRecurringModal from "@/components/billing/MakeRecurringModal";
import { downloadPdf, printPdf } from "@/lib/pdf/download-client";

interface LineItem {
  id: string;
  description: string;
  sku: string | null;
  quantity: number | string;
  unitPrice: number | string;
  taxPercent: number | string;
  amount: number | string;
}

interface InvoicePayment {
  id: string;
  amount: number | string;
  method: string;
  reference: string | null;
  paidAt: string;
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  subtotal: number | string;
  discount: number | string;
  shipping: number | string;
  taxAmount: number | string;
  total: number | string;
  paidAmount: number | string;
  balanceDue: number | string;
  currency?: string;
  notes: string | null;
  terms: string | null;
  internalNotes?: string | null;
  customer?: { id: string; name: string; email?: string | null; company?: string | null } | null;
  items?: LineItem[];
  payments?: InvoicePayment[];
}

export default function InvoiceWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  const { isMobile, isTablet } = useBreakpoint();
  const isDesktop = !isMobile && !isTablet;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [pending, setPending] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showCreditNote, setShowCreditNote] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activityKey, setActivityKey] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (res.status === 404) {
        setMissing(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load invoice");
      const data = (await res.json()) as InvoiceDetail;
      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const handleStatusChange = async (next: string) => {
    if (!invoice) return;
    const previous = invoice.status;
    setPending(true);
    setInvoice({ ...invoice, status: next });
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to update status");
      }
      toast.success(`Status updated to ${getInvoiceStatusMeta(next).label}`);
      setActivityKey((k) => k + 1);
    } catch (err) {
      setInvoice((prev) => (prev ? { ...prev, status: previous } : prev));
      toast.error(err instanceof Error ? err.message : "Couldn't update status");
    } finally {
      setPending(false);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const fallback = `${invoice?.invoiceNumber ?? "invoice"}.pdf`;
      await downloadPdf(`/api/invoices/${invoiceId}/pdf`, fallback);
      setActivityKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF generation failed");
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrint = async () => {
    setPrintLoading(true);
    try {
      await printPdf(`/api/invoices/${invoiceId}/pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open the PDF for printing");
    } finally {
      setPrintLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this invoice? This is permanent.")) return;
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete invoice");
      toast.success("Invoice deleted");
      router.push("/billing");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice");
    }
  };

  const handleDuplicate = async () => {
    setShowMore(false);
    setDuplicating(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to duplicate");
      }
      const data = await res.json();
      toast.success("Invoice duplicated");
      router.push(`/billing/${data.invoice.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate");
    } finally {
      setDuplicating(false);
    }
  };

  if (missing) notFound();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 10, color: "var(--text-muted)" }}>
        <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
        Loading invoice…
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <button onClick={() => router.push("/billing")} style={backBtn}>
          <ArrowLeft size={16} /> Back to Billing
        </button>
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 20, color: "#ef4444", display: "flex", alignItems: "center", gap: 12 }}>
          <AlertTriangle size={20} />
          <span>{error || "Invoice not found"}</span>
        </div>
      </div>
    );
  }

  const items = invoice.items ?? [];
  const payments = invoice.payments ?? [];
  const currency = invoice.currency ?? "INR";
  const money = (v: number | string) => formatCurrency(Number(v), currency);
  const meta = getInvoiceStatusMeta(invoice.status);
  const isPaid = invoice.status === "PAID";

  const actionBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button onClick={handleDownloadPdf} disabled={pdfLoading} className="btn-ghost" style={{ padding: "8px 12px", cursor: pdfLoading ? "wait" : "pointer" }}>
        {pdfLoading ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />} PDF
      </button>
      <button onClick={handlePrint} disabled={printLoading} className="btn-ghost" style={{ padding: "8px 12px", cursor: printLoading ? "wait" : "pointer" }}>
        {printLoading ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Printer size={14} />} Print
      </button>
      {!isPaid && (
        <button onClick={() => setShowPay(true)} className="btn-ghost" style={{ padding: "8px 12px" }}>
          <CreditCard size={14} /> Record Payment
        </button>
      )}
      {!isPaid && (
        <button onClick={() => handleStatusChange("PAID")} className="btn-brand" style={{ padding: "8px 12px" }} disabled={pending}>
          <CheckCircle2 size={14} /> Mark as Paid
        </button>
      )}
      {/* More menu */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setShowMore((s) => !s)} className="btn-ghost" style={{ padding: "8px 10px" }} aria-label="More actions">
          <MoreHorizontal size={16} />
        </button>
        {showMore && (
          <>
            <div onClick={() => setShowMore(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 220, background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 12, boxShadow: "var(--shadow-lg)", zIndex: 50, padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              <MenuItem icon={Pencil} label="Edit" onClick={() => { setShowMore(false); router.push(`/billing/${invoiceId}/edit`); }} />
              <MenuItem icon={Mail} label="Send Email" onClick={() => { setShowMore(false); setShowEmail(true); }} />
              <MenuItem icon={Share2} label="Share Link" onClick={() => { setShowMore(false); setShowShare(true); }} />
              <MenuItem icon={Copy} label={duplicating ? "Duplicating…" : "Duplicate"} onClick={handleDuplicate} />
              <MenuItem icon={Repeat} label="Make Recurring" onClick={() => { setShowMore(false); setShowRecurring(true); }} />
              <MenuItem icon={History} label="Version History" onClick={() => { setShowMore(false); setShowVersions(true); }} />
              <MenuItem icon={FileMinus} label="Convert to Credit Note" onClick={() => { setShowMore(false); setShowCreditNote(true); }} />
              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
              <MenuItem icon={Trash2} label="Delete" onClick={() => { setShowMore(false); handleDelete(); }} danger />
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ── Center invoice panel ──────────────────────────────────
  const centerPanel = (
    <div ref={printRef} className="invoice-print-area">
      {/* Header */}
      <motion.div className="surface" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", fontFamily: "monospace" }}>{invoice.invoiceNumber}</h1>
              <div className="no-print">
                <InvoiceStatusSelect value={invoice.status} pending={pending} onChange={handleStatusChange} />
              </div>
              <span className="print-only" style={{ display: "none", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, color: meta.color, background: `${meta.color}15` }}>{meta.label}</span>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <User size={14} color="var(--text-muted)" /> {invoice.customer?.name ?? "—"}
              {invoice.customer?.company ? ` · ${invoice.customer.company}` : ""}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Total</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)" }}>{money(invoice.total)}</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginTop: 20 }}>
          {[
            { label: "Issued", value: formatDate(invoice.issueDate), icon: Calendar },
            { label: "Due", value: formatDate(invoice.dueDate), icon: Calendar },
            { label: "Created", value: formatDate(invoice.createdAt), icon: Calendar },
            { label: "Last Updated", value: formatDate(invoice.updatedAt), icon: Calendar },
          ].map((m) => (
            <div key={m.label} style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{m.label}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{m.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Line items */}
      <motion.div className="surface" style={{ padding: 24, marginBottom: 20 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>Line Items ({items.length})</h2>
        {items.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "28px 0" }}>No line items.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={th}>Description</th>
                  <th style={{ ...th, textAlign: "right" }}>Qty</th>
                  <th style={{ ...th, textAlign: "right" }}>Unit Price</th>
                  <th style={{ ...th, textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((li) => (
                  <tr key={li.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--text-primary)", fontSize: 13 }}>
                      {li.description}
                      {li.sku && <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 6, fontFamily: "monospace" }}>{li.sku}</span>}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)", fontSize: 13 }}>{Number(li.quantity)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-secondary)", fontSize: 13 }}>{money(li.unitPrice)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{money(li.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <div style={{ width: 260 }}>
            <TotalRow label="Subtotal" value={money(invoice.subtotal)} />
            {Number(invoice.discount) > 0 && <TotalRow label="Discount" value={`- ${money(invoice.discount)}`} />}
            {Number(invoice.shipping) > 0 && <TotalRow label="Shipping" value={money(invoice.shipping)} />}
            <TotalRow label="Tax" value={money(invoice.taxAmount)} />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", marginTop: 4, background: "linear-gradient(135deg, var(--brand-500), var(--brand-600))", color: "#fff", borderRadius: 8 }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{money(invoice.total)}</span>
            </div>
            {Number(invoice.paidAmount) > 0 && <TotalRow label="Paid" value={money(invoice.paidAmount)} color="#10b981" />}
            <TotalRow label="Balance Due" value={money(invoice.balanceDue)} strong color={Number(invoice.balanceDue) > 0 ? "#f59e0b" : "#10b981"} />
          </div>
        </div>
      </motion.div>

      {(invoice.notes || invoice.terms || invoice.internalNotes) && (
        <motion.div className="surface" style={{ padding: 24 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {invoice.notes && (
            <div style={{ marginBottom: invoice.terms || invoice.internalNotes ? 16 : 0 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Notes</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div style={{ marginBottom: invoice.internalNotes ? 16 : 0 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>Terms &amp; Conditions</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{invoice.terms}</p>
            </div>
          )}
          {invoice.internalNotes && (
            <div className="no-print" style={{ padding: 12, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Internal Notes · staff only</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{invoice.internalNotes}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );

  // ── Right summary panel ───────────────────────────────────
  const rightPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="surface" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Summary</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <SummaryCard label="Outstanding" value={formatCompactCurrency(Number(invoice.balanceDue))} color="#f59e0b" />
          <SummaryCard label="Paid" value={formatCompactCurrency(Number(invoice.paidAmount))} color="#10b981" />
        </div>
      </div>

      <div className="surface" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Activity</h2>
        <InvoiceActivityTimeline invoiceId={invoice.id} refreshKey={activityKey} />
      </div>

      <div className="surface" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Payments ({payments.length})</h2>
        {payments.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No payments yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {payments.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>{money(p.amount)}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.method?.replace(/_/g, " ")} · {formatDateTime(p.paidAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }} className="no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/billing")} style={backBtn}>
            <ArrowLeft size={16} /> Billing
          </button>
          {!isDesktop && (
            <button onClick={() => setShowSidebar((s) => !s)} className="btn-ghost" style={{ padding: "8px 12px" }}>
              <PanelLeft size={14} /> Invoices
            </button>
          )}
        </div>
        {actionBar}
      </div>

      {/* Collapsible sidebar for tablet/mobile */}
      {!isDesktop && showSidebar && (
        <div className="surface" style={{ padding: 16, marginBottom: 20, height: 420 }}>
          <InvoiceListSidebar currentId={invoice.id} />
        </div>
      )}

      {isDesktop ? (
        <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr) 340px", gap: 20, alignItems: "start" }}>
          <div className="surface no-print" style={{ padding: 16, position: "sticky", top: 16, height: "calc(100vh - 120px)" }}>
            <InvoiceListSidebar currentId={invoice.id} />
          </div>
          {centerPanel}
          <div className="no-print" style={{ position: "sticky", top: 16 }}>{rightPanel}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {centerPanel}
          <div className="no-print">{rightPanel}</div>
        </div>
      )}

      {showPay && (
        <RecordPaymentModal
          invoiceId={invoice.id}
          balanceDue={Number(invoice.balanceDue)}
          currency={currency}
          onClose={() => setShowPay(false)}
          onSuccess={() => {
            fetchInvoice();
            setActivityKey((k) => k + 1);
          }}
        />
      )}

      {showEmail && (
        <SendEmailModal
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          defaultTo={invoice.customer?.email}
          onClose={() => setShowEmail(false)}
          onSent={() => {
            fetchInvoice();
            setActivityKey((k) => k + 1);
          }}
        />
      )}

      {showShare && (
        <ShareModal
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          onClose={() => setShowShare(false)}
        />
      )}

      {showVersions && (
        <VersionHistoryModal
          invoiceId={invoice.id}
          currency={currency}
          onClose={() => setShowVersions(false)}
        />
      )}

      {showCreditNote && (
        <CreditNoteModal
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          currency={currency}
          onClose={() => setShowCreditNote(false)}
          onIssued={() => setActivityKey((k) => k + 1)}
        />
      )}

      {showRecurring && (
        <MakeRecurringModal
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          onClose={() => setShowRecurring(false)}
          onChanged={() => setActivityKey((k) => k + 1)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: inline-block !important; }
        }
      `}</style>
    </div>
  );
}

// ── Small presentational helpers ──────────────────────────────
const backBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-secondary)",
  fontSize: 14,
};

const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", color: "var(--text-muted)", fontSize: 12, fontWeight: 500 };

function TotalRow({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: strong ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: strong ? 15 : 14, color: color ?? "var(--text-primary)", fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: 14, border: "1px solid var(--border)" }}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700, color }}>{value}</p>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  soon,
  danger,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  soon?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        border: "none",
        background: "none",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        fontSize: 13,
        color: danger ? "#ef4444" : "var(--text-secondary)",
      }}
    >
      <Icon size={14} />
      <span style={{ flex: 1 }}>{label}</span>
      {soon && <span style={{ fontSize: 9, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 4px" }}>SOON</span>}
    </button>
  );
}
