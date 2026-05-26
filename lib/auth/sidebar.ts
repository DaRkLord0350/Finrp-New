// ============================================================
// lib/auth/sidebar.ts
// Sidebar filtering logic based on user permissions.
// ============================================================

import { getCurrentUser } from "./session";
import { hasPermission, hasAnyPermission } from "./access";
import type { SidebarItem, SidebarGroup } from "@/constants/sidebar";

/**
 * Filter sidebar items based on user's permissions.
 * Returns only items the user has access to.
 *
 * Usage:
 *   const items = await getVisibleSidebarItems();
 *   items.forEach(item => console.log(item.label));
 */
export async function getVisibleSidebarItems(
  items: SidebarItem[]
): Promise<SidebarItem[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    // Filter items based on permission
    const visible = await Promise.all(
      items.map(async (item) => {
        // No permission required - always show
        if (!item.permission) {
          return item;
        }

        // Check if user has the required permission
        const allowed = await hasPermission(item.permission);
        return allowed ? item : null;
      })
    );

    return visible.filter((item): item is SidebarItem => item !== null);
  } catch (error) {
    console.error("[getVisibleSidebarItems]", error);
    return [];
  }
}

/**
 * Filter sidebar groups based on user's permissions.
 * Removes groups with no visible items.
 */
export async function getVisibleSidebarGroups(
  groups: SidebarGroup[]
): Promise<SidebarGroup[]> {
  try {
    const filtered = await Promise.all(
      groups.map(async (group) => ({
        ...group,
        items: await getVisibleSidebarItems(group.items),
      }))
    );

    // Remove groups with no items
    return filtered.filter((group) => group.items.length > 0);
  } catch (error) {
    console.error("[getVisibleSidebarGroups]", error);
    return [];
  }
}

/**
 * Check if a specific sidebar item is accessible to the current user.
 *
 * Usage:
 *   const canAccessCompliance = await canAccessSidebarItem(complianceItem);
 */
export async function canAccessSidebarItem(item: SidebarItem): Promise<boolean> {
  if (!item.permission) return true;

  try {
    return await hasPermission(item.permission);
  } catch {
    return false;
  }
}

/**
 * Check if user can access ANY of the provided sidebar items.
 */
export async function canAccessAnySidebarItem(
  items: SidebarItem[]
): Promise<boolean> {
  const permissions = items
    .map((item) => item.permission)
    .filter((p): p is string => !!p);

  if (permissions.length === 0) return true; // No permissions required

  try {
    return await hasAnyPermission(permissions);
  } catch {
    return false;
  }
}
