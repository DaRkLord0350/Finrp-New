// ============================================================
// lib/integrations/status-presentation.ts
//
// Shared status-badge presentation for IntegrationStatus values.
// Extracted from app/(dashboard)/integrations/IntegrationsClient.tsx
// so the Integration Health page can reuse the same icon/color/label
// mapping instead of duplicating it.
// ============================================================

import { CheckCircle2, RefreshCw, AlertCircle, Clock, XCircle, type LucideIcon } from "lucide-react";

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const STATUS_ICON: Record<string, LucideIcon> = {
  ACTIVE: CheckCircle2,
  SYNCING: RefreshCw,
  EXPIRED: AlertCircle,
  ERROR: AlertCircle,
  PENDING_AUTH: Clock,
  INACTIVE: XCircle,
};

export const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#10b981",
  SYNCING: "#3b82f6",
  EXPIRED: "#f59e0b",
  ERROR: "#ef4444",
  PENDING_AUTH: "#f59e0b",
  INACTIVE: "#6b7280",
};

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Connected",
  SYNCING: "Syncing",
  EXPIRED: "Token Expired",
  ERROR: "Error",
  PENDING_AUTH: "Auth Pending",
  INACTIVE: "Inactive",
};
