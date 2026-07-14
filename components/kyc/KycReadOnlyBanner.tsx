"use client";

// ============================================================
// components/kyc/KycReadOnlyBanner.tsx
//
// Module 10 — persistent banner shown above the dashboard while an
// org's KYC isn't APPROVED yet. Mirrors ClientBanner's fixed-bar
// conditional-render pattern (deliberately visible, not a toast —
// the user should never wonder why an action is disabled).
// ============================================================

import Link from "next/link";
import { AlertTriangle, ShieldCheck, XCircle, Clock } from "lucide-react";
import type { KycStatus } from "@prisma/client";

const COPY: Record<KycStatus, { icon: React.ReactNode; text: string; color: string }> = {
  DRAFT: { icon: <Clock size={15} />, text: "Complete your KYC to unlock full workspace access.", color: "#6b7280" },
  SUBMITTED: { icon: <ShieldCheck size={15} />, text: "KYC submitted — verification in progress.", color: "#3b82f6" },
  VERIFICATION_PENDING: { icon: <ShieldCheck size={15} />, text: "Verifying your details with TBX — some actions are read-only until this completes.", color: "#f59e0b" },
  KYC_PENDING: { icon: <Clock size={15} />, text: "Verification complete — awaiting final approval.", color: "#8b5cf6" },
  APPROVED: { icon: <ShieldCheck size={15} />, text: "KYC approved.", color: "#10b981" },
  REJECTED: { icon: <XCircle size={15} />, text: "Your KYC submission was rejected — please review and resubmit.", color: "#ef4444" },
  SUSPENDED: { icon: <AlertTriangle size={15} />, text: "Your workspace has been suspended pending review.", color: "#ef4444" },
  EXPIRED: { icon: <AlertTriangle size={15} />, text: "Your KYC verification has expired — please resubmit.", color: "#ef4444" },
};

export default function KycReadOnlyBanner({ status }: { status: KycStatus | null }) {
  if (!status || status === "APPROVED") return null;
  const copy = COPY[status];

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        background: `${copy.color}15`,
        borderBottom: `1px solid ${copy.color}30`,
        color: copy.color,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {copy.icon}
      <span style={{ flex: 1 }}>{copy.text}</span>
      <Link href="/onboarding/customer" style={{ color: copy.color, textDecoration: "underline", flexShrink: 0 }}>
        {status === "DRAFT" || status === "REJECTED" || status === "EXPIRED" ? "Complete KYC" : "View status"}
      </Link>
    </div>
  );
}
