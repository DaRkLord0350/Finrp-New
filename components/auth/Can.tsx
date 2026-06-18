"use client";

// ============================================================
// components/auth/Can.tsx
//
// Declarative client-side permission gate. Wrap any action (button,
// link, control) the current role may not be allowed to use.
//
//   <Can permission="invoices.write">
//     <button>New Invoice</button>
//   </Can>
//
//   <Can module="crm" fallback={<UpgradeHint />}> ... </Can>
//
//   // Render disabled with a lock instead of hiding:
//   <Can permission="customers.delete" lock>
//     <button>Delete</button>
//   </Can>
//
// UX ONLY — the server must independently enforce the same rule.
// ============================================================

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import type { Action, AppModule } from "@/lib/auth/rbac";

interface CanProps {
  children: ReactNode;
  /** raw `<resource>.<action>` permission, e.g. "invoices.write" */
  permission?: string;
  /** resource + action pair (alternative to `permission`) */
  resource?: string;
  action?: Action | string;
  /** module-level gate, e.g. "crm" */
  module?: AppModule;
  /** rendered when access is denied (ignored when `lock` is set) */
  fallback?: ReactNode;
  /** when true, render children disabled + lock icon instead of hiding */
  lock?: boolean;
}

export function Can({
  children,
  permission,
  resource,
  action,
  module,
  fallback = null,
  lock = false,
}: CanProps) {
  const { can, canAction, canModule } = usePermissions();

  let allowed = true;
  if (permission) allowed = can(permission);
  else if (resource && action) allowed = canAction(resource, action);
  else if (module) allowed = canModule(module);

  if (allowed) return <>{children}</>;

  if (lock) {
    return (
      <span
        aria-disabled="true"
        title="You don't have permission for this action"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          opacity: 0.5,
          cursor: "not-allowed",
          pointerEvents: "none",
        }}
      >
        {children}
        <Lock size={12} style={{ flexShrink: 0 }} />
      </span>
    );
  }

  return <>{fallback}</>;
}

export default Can;
