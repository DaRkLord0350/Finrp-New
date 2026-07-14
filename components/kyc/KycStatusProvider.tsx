"use client";

// ============================================================
// components/kyc/KycStatusProvider.tsx
//
// Module 10 — Workspace Activation. Mirrors EntitlementsProvider's
// shape (closer semantic match than PermissionsProvider — this is
// also a "lock the UI based on a status, don't hide" provider).
// UX only: the server independently re-checks via
// lib/kyc/guards.ts's assertWorkspaceWritable() wherever a route
// opts into it. Grandfathered orgs (no KycProfile row) always get
// isReadOnly=false, computed server-side in app/(dashboard)/layout.tsx.
// ============================================================

import { createContext, useContext, useMemo } from "react";
import type { KycStatus } from "@prisma/client";

export interface KycStatusContextValue {
  isReadOnly: boolean;
  status: KycStatus | null;
}

const KycStatusContext = createContext<KycStatusContextValue>({ isReadOnly: false, status: null });

export function KycStatusProvider({
  isReadOnly,
  status,
  children,
}: {
  isReadOnly: boolean;
  status: KycStatus | null;
  children: React.ReactNode;
}) {
  const value = useMemo<KycStatusContextValue>(() => ({ isReadOnly, status }), [isReadOnly, status]);
  return <KycStatusContext.Provider value={value}>{children}</KycStatusContext.Provider>;
}

export function useKycStatus(): KycStatusContextValue {
  return useContext(KycStatusContext);
}
