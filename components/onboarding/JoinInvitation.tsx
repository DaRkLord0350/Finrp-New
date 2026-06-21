"use client";

// ============================================================
// components/onboarding/JoinInvitation.tsx
//
// "Join via CA Invitation" screen. Looks up a pending invitation for the
// signed-in user's email and joins the inviter's organization as a
// member (no new org, no plan, no payment). On success, routes straight
// to the portal for the invited role.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, ArrowRight, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { actionAcceptInvitationForCurrentUser } from "@/actions/accept-invitation";

export function JoinInvitation({ email }: { email: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "checking" | "joined">("idle");
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setError(null);
    setStatus("checking");
    try {
      const res = await actionAcceptInvitationForCurrentUser();
      if (!res.success) {
        setError(res.error ?? "No invitation found.");
        setStatus("idle");
        return;
      }
      setStatus("joined");
      router.push(res.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <button
          onClick={() => router.push("/onboarding/welcome")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20, padding: "8px 12px", borderRadius: 9, background: "transparent", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "36px 32px", textAlign: "center", boxShadow: "var(--shadow-lg)" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            {status === "joined" ? <CheckCircle2 size={26} color="white" /> : <Mail size={26} color="white" />}
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 10 }}>
            {status === "joined" ? "You're in!" : "Join via CA Invitation"}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
            {status === "joined"
              ? "Taking you to your workspace…"
              : <>We&apos;ll check for a pending invitation addressed to <strong style={{ color: "var(--text-primary)" }}>{email}</strong> and add you to your CA firm&apos;s workspace — no plan or payment needed.</>}
          </p>

          {error && (
            <p style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13, marginBottom: 18, textAlign: "left" }}>
              {error}
            </p>
          )}

          {status !== "joined" && (
            <button
              className="btn-brand"
              onClick={join}
              disabled={status === "checking"}
              style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 20px", fontSize: 15, fontWeight: 700 }}
            >
              {status === "checking" ? <><Loader2 size={17} className="animate-spin" /> Checking…</> : <>Join my CA firm <ArrowRight size={17} /></>}
            </button>
          )}

          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 18 }}>
            Don&apos;t have an invitation?{" "}
            <button onClick={() => router.push("/onboarding/role")} style={{ background: "none", border: "none", color: "var(--brand-400)", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 12 }}>
              Start your own business
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
