import Link from "next/link";
import {
  Bot,
  Sparkles,
  MessageSquare,
  TrendingUp,
  ShieldCheck,
  FileText,
  ArrowRight,
} from "lucide-react";

// ============================================================
// /ai-bot — AI Bot hub
// Landing page for FinRP's AI tooling. The conversational
// assistant lives at /advisor; additional AI capabilities are
// surfaced here as they ship.
// ============================================================

const CAPABILITIES = [
  {
    label: "AI Business Advisor",
    description: "Chat with your data — revenue, invoices, customers, and compliance, answered in plain language.",
    icon: MessageSquare,
    color: "#6366f1",
    href: "/advisor",
    live: true,
  },
  {
    label: "AI Insights",
    description: "Cash-flow anomalies, spend categorisation, and risk signals surfaced automatically from your banking data.",
    icon: TrendingUp,
    color: "#0ea5e9",
    href: "/banking/ai-insights",
    live: true,
  },
  {
    label: "Compliance Copilot",
    description: "Draft filings, summarise notices, and track upcoming deadlines with AI assistance.",
    icon: ShieldCheck,
    color: "#10b981",
    href: "/ai-bot",
    live: false,
  },
  {
    label: "Document Intelligence",
    description: "Extract structured data from invoices, bills, and receipts — no manual entry.",
    icon: FileText,
    color: "#f59e0b",
    href: "/ai-bot",
    live: false,
  },
];

export default function AiBotPage() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(16,185,129,0.2))",
            border: "1px solid rgba(99,102,241,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Bot size={22} color="#818cf8" />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            AI Bot
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 2 }}>
            Your AI workspace — powered by Gemini 2.5 Flash.
          </p>
        </div>
        <Link href="/advisor" className="btn-brand" style={{ marginLeft: "auto" }}>
          <Sparkles size={15} /> Open AI Advisor
        </Link>
      </div>

      {/* Capability grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 18,
        }}
      >
        {CAPABILITIES.map((c) => {
          const Icon = c.icon;
          const card = (
            <div
              className="section-card"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                height: "100%",
                cursor: c.live ? "pointer" : "default",
                opacity: c.live ? 1 : 0.7,
                transition: "border-color 0.15s ease, transform 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `${c.color}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color={c.color} />
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{c.label}</h2>
                {!c.live && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color: "var(--text-muted)",
                      background: "rgba(148,163,184,0.15)",
                      padding: "2px 7px",
                      borderRadius: 4,
                    }}
                  >
                    SOON
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, flex: 1 }}>{c.description}</p>
              {c.live && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: c.color,
                  }}
                >
                  Open <ArrowRight size={12} />
                </span>
              )}
            </div>
          );

          return c.live ? (
            <Link key={c.label} href={c.href} style={{ textDecoration: "none" }}>
              {card}
            </Link>
          ) : (
            <div key={c.label}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
