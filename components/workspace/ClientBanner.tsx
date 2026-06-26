"use client";

// ============================================================
// ClientBanner — persistent impersonation indicator.
//
// Rendered by DashboardShell as a fixed 44px bar above the
// sidebar + topbar (see .workspace-banner / .workspace-shell in
// globals.css) whenever a CA is inside a client workspace.
// Shows who is being impersonated, the acting CA, the permission
// scope, a CustomerSwitcher and the ExitWorkspace button.
// Deliberately loud — a CA must never mistake a client's books
// for their own.
// ============================================================

import { Eye, ShieldCheck } from "lucide-react";
import CustomerSwitcher from "./CustomerSwitcher";
import ExitWorkspaceButton from "./ExitWorkspaceButton";

export interface WorkspaceBannerData {
  organizationId: string;
  organizationName: string;
  caName: string;
  role: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export default function ClientBanner({ workspace }: { workspace: WorkspaceBannerData }) {
  return (
    <div
      className="workspace-banner"
      role="status"
      aria-label={`Viewing Customer Workspace: ${workspace.organizationName}`}
      style={{
        background: "linear-gradient(90deg, #4f46e5, #7c3aed, #0ea5e9)",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <Eye size={15} />
        <span
          className="ws-hide-sm"
          style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}
        >
          Viewing Customer Workspace
        </span>
      </div>

      <CustomerSwitcher
        currentOrgId={workspace.organizationId}
        currentName={workspace.organizationName}
      />

      <span
        className="ws-hide-sm"
        style={{
          fontSize: 12,
          opacity: 0.9,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        Logged in as <strong>{workspace.caName}</strong>
        {workspace.isSuperAdmin ? " · Super Admin" : ` · ${workspace.role.replace(/_/g, " ")}`}
      </span>

      <span
        className="ws-hide-sm"
        title={workspace.permissions.join(", ")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 8px",
          borderRadius: 99,
          background: "rgba(255,255,255,0.15)",
          flexShrink: 0,
        }}
      >
        <ShieldCheck size={12} />
        {workspace.isSuperAdmin ? "Full access" : `${workspace.permissions.length} permissions`}
      </span>

      <span className="ws-hide-sm" style={{ fontSize: 11, opacity: 0.75, flexShrink: 0 }}>
        All actions are audit-logged
      </span>

      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
        <ExitWorkspaceButton />
      </div>
    </div>
  );
}
