// ============================================================
// constants/sidebar.ts
// Sidebar navigation configuration with permission matrix.
// Each item defines the minimum permission required to access it.
// ============================================================

import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  ShieldCheck,
  Bot,
  Settings,
  Boxes,
  LucideIcon,
} from "lucide-react";

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string; // Optional permission to access this item
  badge?: {
    label: string;
    variant?: "success" | "warning" | "error" | "info";
  };
}

/**
 * Main navigation items with associated permissions.
 * Items without a permission are accessible to all authenticated users.
 */
export const sidebarNavItems: SidebarItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.read",
  },
  {
    label: "CRM",
    href: "/crm",
    icon: Users,
    permission: "customers.read",
  },
  {
    label: "Billing",
    href: "/billing",
    icon: FileText,
    permission: "invoices.read",
  },
  {
    label: "Finance",
    href: "/finance",
    icon: BarChart3,
    permission: "finance.read",
  },
  {
    label: "ERP",
    href: "/erp",
    icon: Boxes,
    permission: "erp.read",
  },
  {
    label: "Compliance",
    href: "/compliance",
    icon: ShieldCheck,
    permission: "compliance.read",
  },
  {
    label: "AI Advisor",
    href: "/advisor",
    icon: Bot,
    permission: "advisor.access",
  },
];

/**
 * Bottom section items (typically settings, help, etc.)
 */
export const sidebarBottomItems: SidebarItem[] = [
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    permission: "settings.read",
  },
];

/**
 * Get all sidebar items (top + bottom).
 */
export function getAllSidebarItems(): SidebarItem[] {
  return [...sidebarNavItems, ...sidebarBottomItems];
}

/**
 * Grouped navigation items for future expansion.
 * Useful if you want to organize items by category.
 */
export interface SidebarGroup {
  title: string;
  items: SidebarItem[];
}

export const sidebarGroups: SidebarGroup[] = [
  {
    title: "Main Menu",
    items: sidebarNavItems,
  },
  {
    title: "Settings",
    items: sidebarBottomItems,
  },
];

/**
 * AI Advisor badge configuration
 */
export const aiAdvisorBadge = {
  label: "AI Advisor Active",
  description: "Gemini 2.5 Flash",
  enabled: true,
};
