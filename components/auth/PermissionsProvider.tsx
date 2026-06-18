"use client";

// ============================================================
// components/auth/PermissionsProvider.tsx
//
// Ships the current user's resolved RBAC role + permission list to
// the client so UI gates (<Can>, usePermissions, dynamic Sidebar)
// can hide or lock unauthorized actions WITHOUT another round-trip.
//
// This is a UX layer only — every server action and API route MUST
// re-verify permissions independently. Never trust client checks.
// ============================================================

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Role } from "@prisma/client";

export interface PermissionsContextValue {
  role: Role | null;
  permissions: string[];
}

const PermissionsContext = createContext<PermissionsContextValue>({
  role: null,
  permissions: [],
});

export function PermissionsProvider({
  role,
  permissions,
  children,
}: {
  role: Role | null;
  permissions: string[];
  children: ReactNode;
}) {
  const value = useMemo<PermissionsContextValue>(
    () => ({ role, permissions }),
    [role, permissions]
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissionsContext(): PermissionsContextValue {
  return useContext(PermissionsContext);
}
