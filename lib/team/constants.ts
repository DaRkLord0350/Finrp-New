// ============================================================
// lib/team/constants.ts
//
// Firm team-member taxonomy shared by the API layer, importer and
// UI. The firm-internal designation (FirmMemberRole) is distinct
// from the platform-level UserRole that governs portal access — a
// member's designation is mapped to a UserRole on invite acceptance.
// ============================================================

import type { FirmMemberRole, Specialization, UserRole, FirmPermission } from "@prisma/client";

export const FIRM_MEMBER_ROLES: FirmMemberRole[] = [
  "CA",
  "MANAGER",
  "PARTNER",
  "ARTICLE_ASSISTANT",
  "ADMIN",
];

export const FIRM_PERMISSIONS: FirmPermission[] = [
  "MANAGE_CUSTOMERS",
  "ASSIGN_TASKS",
  "VIEW_REPORTS",
  "MANAGE_TEAM",
];

export const FIRM_PERMISSION_LABELS: Record<FirmPermission, string> = {
  MANAGE_CUSTOMERS: "Manage Customers",
  ASSIGN_TASKS: "Assign Tasks",
  VIEW_REPORTS: "View Reports",
  MANAGE_TEAM: "Manage Team",
};

export const FIRM_PERMISSION_DESCRIPTIONS: Record<FirmPermission, string> = {
  MANAGE_CUSTOMERS: "Create, edit and archive customers",
  ASSIGN_TASKS: "Assign and reassign tasks to team members",
  VIEW_REPORTS: "Access firm analytics and reports",
  MANAGE_TEAM: "Invite, edit and deactivate team members",
};

export const SPECIALIZATIONS: Specialization[] = [
  "GST",
  "INCOME_TAX",
  "AUDIT",
  "ROC",
  "ACCOUNTING",
  "PAYROLL",
];

export const FIRM_ROLE_LABELS: Record<FirmMemberRole, string> = {
  CA: "CA",
  MANAGER: "Manager",
  PARTNER: "Partner",
  ARTICLE_ASSISTANT: "Article Assistant",
  ADMIN: "Admin",
};

export const FIRM_ROLE_COLORS: Record<FirmMemberRole, string> = {
  CA: "#0ea5e9",
  MANAGER: "#8b5cf6",
  PARTNER: "#ec4899",
  ARTICLE_ASSISTANT: "#f59e0b",
  ADMIN: "#10b981",
};

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  GST: "GST",
  INCOME_TAX: "Income Tax",
  AUDIT: "Audit",
  ROC: "ROC",
  ACCOUNTING: "Accounting",
  PAYROLL: "Payroll",
};

// Map a firm designation → platform UserRole. "Admin" and "Partner"
// firm members run the full firm portal (CA_FIRM_ADMIN); everyone else
// operates as a CA within the firm.
export function firmRoleToUserRole(role: FirmMemberRole): UserRole {
  return role === "ADMIN" || role === "PARTNER" ? "CA_FIRM_ADMIN" : "CA";
}

// Map a firm designation → legacy org Role (used by Membership/Invitation.role).
export function firmRoleToOrgRole(role: FirmMemberRole): "ADMIN" | "MANAGER" | "STAFF" {
  if (role === "ADMIN" || role === "PARTNER") return "ADMIN";
  if (role === "MANAGER") return "MANAGER";
  return "STAFF";
}

// Tolerant parsers for spreadsheet import (case / spacing insensitive).
export function parseFirmRole(raw: string): FirmMemberRole | null {
  const v = raw.trim().toUpperCase().replace(/\s+/g, "_");
  switch (v) {
    case "CA":
      return "CA";
    case "MANAGER":
      return "MANAGER";
    case "PARTNER":
      return "PARTNER";
    case "ARTICLE_ASSISTANT":
    case "ARTICLEASSISTANT":
    case "ARTICLE":
      return "ARTICLE_ASSISTANT";
    case "ADMIN":
    case "ADMINISTRATOR":
      return "ADMIN";
    default:
      return null;
  }
}

export function parseSpecialization(raw: string): Specialization | null {
  const v = raw.trim().toUpperCase().replace(/\s+/g, "_");
  switch (v) {
    case "GST":
      return "GST";
    case "INCOME_TAX":
    case "INCOMETAX":
    case "IT":
      return "INCOME_TAX";
    case "AUDIT":
      return "AUDIT";
    case "ROC":
      return "ROC";
    case "ACCOUNTING":
    case "ACCOUNTS":
      return "ACCOUNTING";
    case "PAYROLL":
      return "PAYROLL";
    default:
      return null;
  }
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
