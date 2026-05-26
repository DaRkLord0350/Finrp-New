// ============================================================
// components/auth/Can.tsx
// Permission-based component for conditional UI rendering.
// Hides UI elements from users lacking required permissions.
//
// SECURITY NOTE:
// This is a UX feature only. It does NOT enforce security.
// Always validate permissions server-side on APIs and pages.
// Never rely on this component for security decisions.
// ============================================================

"use client";

import { hasPermission, hasAnyPermission, hasAllPermissions } from "@/lib/auth/access";
import { useEffect, useState } from "react";

interface CanProps {
  /**
   * Single permission to check.
   * Use when user needs ONE specific permission.
   * Example: "invoices.write"
   */
  permission?: string;

  /**
   * Array of permissions — user needs ANY of these.
   * Use for "can do X OR Y" scenarios.
   * Example: ["invoices.approve", "compliance.approve"]
   */
  anyOf?: string[];

  /**
   * Array of permissions — user needs ALL of these.
   * Use for "can do X AND Y" scenarios.
   * Example: ["invoices.write", "invoices.approve"]
   */
  allOf?: string[];

  /**
   * Content to render if user HAS permission.
   */
  children: React.ReactNode;

  /**
   * Optional fallback content if user LACKS permission.
   * If not provided, nothing is rendered (default secure behavior).
   */
  fallback?: React.ReactNode;
}

/**
 * Permission-based rendering component.
 *
 * Examples:
 *
 * // Single permission
 * <Can permission="invoices.write">
 *   <Button>Add Invoice</Button>
 * </Can>
 *
 * // Multiple permissions (user needs ANY)
 * <Can anyOf={["invoices.approve", "compliance.approve"]}>
 *   <ApprovalQueue />
 * </Can>
 *
 * // Multiple permissions (user needs ALL)
 * <Can allOf={["invoices.write", "invoices.approve"]}>
 *   <AdvancedEditor />
 * </Can>
 *
 * // With fallback
 * <Can permission="users.write" fallback={<p>No access</p>}>
 *   <UserManagement />
 * </Can>
 */
export function Can({
  permission,
  anyOf,
  allOf,
  children,
  fallback,
}: CanProps): React.ReactNode {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkPermission() {
      try {
        let hasAccess = false;

        if (permission) {
          hasAccess = await hasPermission(permission);
        } else if (anyOf) {
          hasAccess = await hasAnyPermission(anyOf);
        } else if (allOf) {
          hasAccess = await hasAllPermissions(allOf);
        }

        setAllowed(hasAccess);
      } catch (error) {
        console.error("[Can] Permission check failed:", error);
        setAllowed(false);
      } finally {
        setLoading(false);
      }
    }

    checkPermission();
  }, [permission, anyOf, allOf]);

  // Still loading permissions
  if (loading) {
    return null;
  }

  // User has permission
  if (allowed) {
    return children;
  }

  // User lacks permission
  return fallback ?? null;
}
