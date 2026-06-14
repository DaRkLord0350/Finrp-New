"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, ShieldCheck, ClipboardCheck, ReceiptText, FileSpreadsheet, FileWarning, Bot, User } from "lucide-react";
import { copilotSuggestions } from "@/lib/ca-hub/demo-data";

const DOMAINS = [
  { key: "Compliance", icon: ShieldCheck, accent: "#10b981", blurb: "Due dates, applicability & statutory rules" },
  { key: "Audit", icon: ClipboardCheck, accent: "#ec4899", blurb: "Workpapers, CARO, sampling & 3CD" },
  { key: "GST", icon: ReceiptText, accent: "#f59e0b", blurb: "Rates, ITC, returns & e-invoicing" },
  { key: "Tax", icon: FileSpreadsheet, accent: "#8b5cf6", blurb: "Computation, regime choice & deductions" },
  { key: "Notice", icon: FileWarning, accent: "#ef4444", blurb: "Draft replies to departmental notices" },
] as const;

type DomainKey = typeof DOMAINS[number]["key"];

interface Msg { role: "user" | "assistant"; content: string }

const CANNED: Record<DomainKey, string> = {
  Compliance: "Based on your client portfolio, **6 obligations are due within 7 days**: GSTR-1 (Orbit Logistics, today), GSTR-3B for Acme & Lumen (20 Jun), and the PF/ESI challan for Sunrise Foods (15 Jun). I can draft reminder emails or create tasks for the assigned staff — just say the word.",
  Audit: "For inter-corporate loans under **CARO 2020 clause (iii)**, confirm: (a) terms are not prejudicial to the company's interest, (b) repayment schedule is stipulated and regular, and (c) overdue amounts > 90 days. Here's a draft observation you can adapt to the engagement file…",
  GST: "**ITC on capital goods (Rule 43):** credit is available but must be reversed proportionately over 60 months for any exempt-supply usage. For a machine of ₹12L (GST ₹2.16L) used 20% for exempt supplies, the monthly reversal works out to ₹720. Want the full computation sheet?",
  Tax: "For a ₹18L salary with 80C fully utilised: **Old regime** tax ≈ ₹2.96L (after ₹1.5L 80C + ₹50K standard deduction); **New regime** tax ≈ ₹2.81L (FY25-26 slabs, ₹75K standard deduction). The new regime saves ~₹15K here. Shall I factor in HRA and 80D?",
  Notice: "Here's a draft response to a **Section 143(1)(a) intimation** for a mismatch in reported interest income: it acknowledges the variance, attaches Form 26AS reconciliation, and either agrees or contests with supporting computation. Review the placeholders before filing on the portal…",
};

export default function CopilotPage() {
  const [domain, setDomain] = useState<DomainKey>("Compliance");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setMessages((m) => [...m, { role: "user", content: t }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", content: CANNED[domain] }]);
      setThinking(false);
    }, 900);
  };

  const active = DOMAINS.find((d) => d.key === domain)!;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 56px)", maxHeight: "calc(100vh - 56px)" }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(99,102,241,0.2))", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={21} color="#f97316" strokeWidth={2} />
        </div>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>AI CA Copilot</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Gemini-powered assistant for compliance, audit, GST, tax &amp; notices</p>
        </div>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#10b981", fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }} /> Online
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 16, flex: 1, minHeight: 0 }}>
        {/* Domain rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DOMAINS.map((d) => {
            const Icon = d.icon;
            const sel = domain === d.key;
            return (
              <button
                key={d.key}
                onClick={() => { setDomain(d.key); setMessages([]); }}
                style={{
                  textAlign: "left", cursor: "pointer", borderRadius: 11, padding: "11px 13px",
                  border: sel ? `1.5px solid ${d.accent}66` : "1px solid var(--border)",
                  background: sel ? `${d.accent}12` : "var(--bg-card)",
                  display: "flex", flexDirection: "column", gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={15} color={d.accent} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{d.key}</span>
                </div>
                <span style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.4 }}>{d.blurb}</span>
              </button>
            );
          })}
        </div>

        {/* Chat column */}
        <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", minHeight: 0 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 440, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div style={{ width: 54, height: 54, borderRadius: 14, background: `${active.accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <active.icon size={26} color={active.accent} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{active.key} Assistant</h3>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.6 }}>
                    Ask anything about {active.key.toLowerCase()} for your clients. Responses are grounded in your practice data.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%" }}>
                  {copilotSuggestions.filter((s) => s.domain === domain || (domain === "Tax" && s.domain === "Tax")).concat(copilotSuggestions.filter((s) => s.domain !== domain)).slice(0, 3).map((s) => (
                    <button key={s.q} onClick={() => send(s.q)} style={{ textAlign: "left", cursor: "pointer", fontSize: 12.5, color: "var(--text-secondary)", background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 9, padding: "9px 12px" }}>
                      {s.q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: m.role === "user" ? "var(--bg-hover)" : "linear-gradient(135deg,#f97316,#6366f1)" }}>
                  {m.role === "user" ? <User size={14} color="var(--text-secondary)" /> : <Bot size={14} color="white" />}
                </div>
                <div className={m.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"} style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {renderMarkdownish(m.content)}
                </div>
              </div>
            ))}

            {thinking && (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#f97316,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot size={14} color="white" />
                </div>
                <div className="chat-bubble-ai" style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2].map((d) => (
                    <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)", animation: `pulse 1s ${d * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div style={{ borderTop: "1px solid var(--border)", padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
              placeholder={`Ask the ${active.key} assistant…`}
              style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 10, padding: "11px 14px", fontSize: 13, background: "var(--bg-hover)", color: "var(--text-primary)", outline: "none" }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || thinking}
              style={{ width: 40, height: 40, borderRadius: 10, border: "none", cursor: input.trim() ? "pointer" : "not-allowed", background: "linear-gradient(135deg,#f97316,#6366f1)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", opacity: input.trim() && !thinking ? 1 : 0.5 }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimal **bold** renderer for the canned responses.
function renderMarkdownish(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i} style={{ color: "inherit", fontWeight: 700 }}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
  );
}
