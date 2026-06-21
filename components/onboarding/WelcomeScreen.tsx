"use client";

// ============================================================
// components/onboarding/WelcomeScreen.tsx
//
// The first onboarding screen. Two entry paths:
//   • "Join via CA Invitation" → /onboarding/join (join the inviter's
//     organization as a member; no plan/payment).
//   • "Start Your Own Business" → /onboarding/role (pick CA firm vs
//     business, complete profile, choose a plan).
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Rocket, ArrowRight, Zap, Loader2 } from "lucide-react";

const PATHS = [
  {
    id: "join",
    href: "/onboarding/join",
    title: "Join via CA Invitation",
    subtitle: "Your CA invited you to FinRP",
    icon: Mail,
    accent: "#6366f1",
    glow: "rgba(99,102,241,0.25)",
    blurb: "Join your CA firm's workspace instantly. No plan to choose, no payment — you're set up by your CA.",
    cta: "I have an invitation",
  },
  {
    id: "start",
    href: "/onboarding/role",
    title: "Start Your Own Business",
    subtitle: "Set up a new organization",
    icon: Rocket,
    accent: "#10b981",
    glow: "rgba(16,185,129,0.25)",
    blurb: "Create your own workspace, pick a plan (start free!), and run your finances your way.",
    cta: "Get started",
  },
] as const;

export function WelcomeScreen() {
  const router = useRouter();
  const [navigating, setNavigating] = useState<string | null>(null);

  function go(href: string, id: string) {
    setNavigating(id);
    router.push(href);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 16px 64px" }}>
      <div style={{ width: "100%", maxWidth: 860 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 40 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #6366f1, #10b981)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={17} color="white" />
          </div>
          <span style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(135deg, #818cf8, #34d399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.025em" }}>
            FinRP
          </span>
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-400)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Welcome to FinRP
          </p>
          <h1 style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 12 }}>
            How would you like to begin?
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
            Joining a CA who invited you, or starting your own business? Pick a path to continue.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {PATHS.map((p) => {
            const Icon = p.icon;
            const busy = navigating === p.id;
            return (
              <button
                key={p.id}
                onClick={() => go(p.href, p.id)}
                disabled={!!navigating}
                style={{
                  flex: "1 1 340px",
                  minWidth: 0,
                  textAlign: "left",
                  position: "relative",
                  background: "var(--bg-surface)",
                  border: "2px solid var(--border)",
                  borderRadius: 20,
                  padding: "30px 28px",
                  cursor: navigating ? "wait" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "var(--shadow-lg)",
                }}
                onMouseEnter={(e) => { if (!navigating) { e.currentTarget.style.borderColor = p.accent; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 0 0 3px ${p.glow}, 0 20px 40px rgba(0,0,0,0.12)`; } }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-lg)"; }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${p.accent}, ${p.accent}cc)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                  <Icon size={24} color="white" />
                </div>
                <h2 style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>
                  {p.title}
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, fontWeight: 500 }}>{p.subtitle}</p>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 22, minHeight: 64 }}>{p.blurb}</p>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 12, background: `linear-gradient(135deg, ${p.accent}, ${p.accent}cc)`, color: "white", fontSize: 13, fontWeight: 700 }}>
                  {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                  {p.cta} {!busy && <ArrowRight size={15} strokeWidth={2.5} />}
                </span>
              </button>
            );
          })}
        </div>

        <p style={{ textAlign: "center", marginTop: 28, fontSize: 12, color: "var(--text-muted)" }}>
          Not sure? You can always start your own business and invite a CA later.
        </p>
      </div>
    </div>
  );
}
