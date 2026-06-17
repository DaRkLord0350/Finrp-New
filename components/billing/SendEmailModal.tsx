"use client";

import { useState } from "react";
import { X, Paperclip } from "lucide-react";
import { toast } from "sonner";

const inputStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  padding: "9px 12px",
  fontSize: 14,
  width: "100%",
  outline: "none",
} as const;

const labelStyle = {
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500 as const,
  marginBottom: 6,
  display: "block" as const,
};

const splitEmails = (s: string) =>
  s.split(/[,\s]+/).map((e) => e.trim()).filter(Boolean);

interface SendEmailModalProps {
  invoiceId: string;
  invoiceNumber: string;
  defaultTo?: string | null;
  shareUrl?: string;
  onClose: () => void;
  onSent: () => void;
}

export default function SendEmailModal({
  invoiceId,
  invoiceNumber,
  defaultTo,
  shareUrl,
  onClose,
  onSent,
}: SendEmailModalProps) {
  const [to, setTo] = useState(defaultTo ?? "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(`Invoice ${invoiceNumber}`);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      toast.error("Enter a recipient email");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          cc: splitEmails(cc),
          bcc: splitEmails(bcc),
          subject: subject.trim(),
          message: message.trim() || undefined,
          shareUrl,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to send");
      }
      toast.success("Invoice emailed");
      onSent();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invoice");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20, overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-strong)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Send Invoice</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{invoiceNumber} · PDF attached automatically</p>
          </div>
          <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>To *</label>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@email.com" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>CC</label>
              <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="comma separated" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>BCC</label>
              <input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="comma separated" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Add a note to your customer (optional)…" style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
            <Paperclip size={13} /> {invoiceNumber}.pdf will be attached
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn-brand" disabled={sending} style={{ flex: 1, justifyContent: "center" }}>
              {sending ? "Sending…" : "Send Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
