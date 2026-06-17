"use client";

import { useEffect, useState } from "react";
import { X, FileMinus, Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  reason: string | null;
  total: number | string;
  currency: string;
  createdAt: string;
}

export default function CreditNoteModal({
  invoiceId,
  invoiceNumber,
  currency = "INR",
  onClose,
  onIssued,
}: {
  invoiceId: string;
  invoiceNumber: string;
  currency?: string;
  onClose: () => void;
  onIssued: () => void;
}) {
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [pdfId, setPdfId] = useState<string | null>(null);

  const fetchNotes = async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/credit-note`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setNotes((data.creditNotes ?? []) as CreditNote[]);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issue = async () => {
    setIssuing(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/credit-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to issue credit note");
      }
      const data = await res.json();
      setNotes((prev) => [data.creditNote as CreditNote, ...prev]);
      setReason("");
      toast.success("Credit note issued");
      onIssued();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't issue credit note");
    } finally {
      setIssuing(false);
    }
  };

  const downloadPdf = async (cnId: string) => {
    setPdfId(cnId);
    try {
      const res = await fetch(`/api/credit-notes/${cnId}/pdf`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "PDF generation failed");
      }
      const { pdfUrl } = (await res.json()) as { pdfUrl?: string };
      if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF generation failed");
    } finally {
      setPdfId(null);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20, overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-lg)", maxHeight: "calc(100vh - 40px)", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              <FileMinus size={17} /> Credit Notes
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{invoiceNumber} · full credit of the invoice</p>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            <X size={16} />
          </button>
        </div>

        {/* Issue */}
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <label style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500, marginBottom: 6, display: "block" }}>Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Order cancelled, goods returned…"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", padding: "9px 12px", fontSize: 14, width: "100%", outline: "none", marginBottom: 12 }}
          />
          <button onClick={issue} disabled={issuing} className="btn-brand" style={{ width: "100%", justifyContent: "center" }}>
            <Plus size={15} /> {issuing ? "Issuing…" : "Issue Credit Note"}
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>Loading…</p>
          ) : notes.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>No credit notes issued yet.</p>
          ) : (
            notes.map((cn) => (
              <div key={cn.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "var(--bg-elevated)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>{cn.creditNoteNumber}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {formatDate(cn.createdAt)}{cn.reason ? ` · ${cn.reason}` : ""}
                  </p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#ef4444" }}>-{formatCurrency(Number(cn.total), cn.currency || currency)}</span>
                <button onClick={() => downloadPdf(cn.id)} disabled={pdfId === cn.id} className="btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }}>
                  <Download size={13} /> {pdfId === cn.id ? "…" : "PDF"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
