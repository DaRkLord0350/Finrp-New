"use client";

import type { ComplianceStatus } from "@/types/compliance";

const CONFIG: Record<
  ComplianceStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  DRAFT: {
    label: "Draft",
    color: "#9ca3af",
    bg: "rgba(156,163,175,0.12)",
    border: "rgba(156,163,175,0.3)",
  },
  SUBMITTED: {
    label: "Submitted",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.3)",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
  },
  APPROVED: {
    label: "Approved",
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
  },
  REJECTED: {
    label: "Rejected",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.3)",
  },
  EXPIRED: {
    label: "Expired",
    color: "#6b7280",
    bg: "rgba(107,114,128,0.12)",
    border: "rgba(107,114,128,0.3)",
  },
  PENDING_RENEWAL: {
    label: "Pending Renewal",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.3)",
  },
};

interface Props {
  status: ComplianceStatus;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.DRAFT;
  const padding = size === "sm" ? "2px 7px" : "3px 10px";
  const fontSize = size === "sm" ? 10 : 11;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding,
        borderRadius: 99,
        fontSize,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.color,
          marginRight: 5,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}
