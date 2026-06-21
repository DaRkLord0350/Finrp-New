"use client";

// ============================================================
// components/billing/EntitlementsProvider.tsx
//
// Client-side plan entitlements, mirroring PermissionsProvider. Lets the
// dynamic sidebar + any client gate render plan-locked features as
// LOCKED (lock icon + upgrade link) instead of letting the user click
// through and hit a 402. The server remains the source of truth — this
// is UX only.
//
// `hasFeature` returns true while entitlements are unknown (before the
// provider mounts / legacy orgs) so we only ever LOCK when we positively
// know a feature is not included.
// ============================================================

import { createContext, useContext, useMemo } from "react";
import type { Feature } from "@/lib/billing/features";

export interface EntitlementsContextValue {
  features: ReadonlySet<string>;
  isLegacy: boolean;
  /** True if the current plan grants `feature` (legacy orgs grant all). */
  hasFeature: (feature: Feature) => boolean;
}

const EntitlementsContext = createContext<EntitlementsContextValue>({
  features: new Set(),
  isLegacy: true,
  hasFeature: () => true,
});

export function EntitlementsProvider({
  features,
  isLegacy,
  children,
}: {
  features: string[];
  isLegacy: boolean;
  children: React.ReactNode;
}) {
  const value = useMemo<EntitlementsContextValue>(() => {
    const set = new Set(features);
    return {
      features: set,
      isLegacy,
      hasFeature: (feature: Feature) => isLegacy || set.has(feature),
    };
  }, [features, isLegacy]);

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements(): EntitlementsContextValue {
  return useContext(EntitlementsContext);
}
