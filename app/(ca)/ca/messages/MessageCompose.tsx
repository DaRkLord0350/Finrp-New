"use client";

import { useState } from "react";
import { Send, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  clients: { organizationId: string; name: string }[];
  templates: { key: string; label: string; preview: string }[];
}

export default function MessageCompose({ clients, templates }: Props) {
  const [organizationId, setOrganizationId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateType, setTemplateType] = useState("");
  const [sending, setSending] = useState(false);

  function applyTemplate(key: string) {
    const tpl = templates.find((t) => t.key === key);
    if (!tpl) return;
    setTemplateType(key);
    setSubject(tpl.label);
    setBody(tpl.preview);
  }

  async function handleSend() {
    if (!organizationId) return toast.error("Select a client");
    if (!subject.trim()) return toast.error("Enter a subject");
    if (!body.trim()) return toast.error("Enter a message body");

    setSending(true);
    try {
      const res = await fetch("/api/ca/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, subject, body, templateType: templateType || null }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Message sent");
      setOrganizationId("");
      setSubject("");
      setBody("");
      setTemplateType("");
      window.location.reload();
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Compose Message</h2>

      {/* Client select */}
      <div>
        <label className="label">Client</label>
        <select
          className="input"
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
          style={{ appearance: "none" }}
        >
          <option value="">Select client...</option>
          {clients.map((c) => (
            <option key={c.organizationId} value={c.organizationId}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Template */}
      <div>
        <label className="label">Template (optional)</label>
        <select
          className="input"
          value={templateType}
          onChange={(e) => applyTemplate(e.target.value)}
          style={{ appearance: "none" }}
        >
          <option value="">Choose template...</option>
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Subject */}
      <div>
        <label className="label">Subject</label>
        <input
          type="text"
          className="input"
          placeholder="Message subject..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      {/* Body */}
      <div>
        <label className="label">Message</label>
        <textarea
          className="input"
          placeholder="Type your message..."
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ resize: "vertical" }}
        />
      </div>

      <button
        className="btn-brand"
        style={{ justifyContent: "center" }}
        onClick={handleSend}
        disabled={sending}
      >
        {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        {sending ? "Sending..." : "Send Message"}
      </button>

      {/* Quick templates */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Quick Templates
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {templates.map((t) => (
            <button
              key={t.key}
              className="btn-ghost"
              style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => applyTemplate(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
