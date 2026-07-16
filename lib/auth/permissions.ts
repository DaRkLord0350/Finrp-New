// ============================================================
// lib/auth/permissions.ts
// Role-based access control permission map.
//
// This is the single source of truth for what each Role can do.
// Permission strings follow the convention "<resource>.<action>",
// e.g. "invoices.write". The OWNER wildcard "*" grants everything.
//
// Higher-level helpers (hasModuleAccess / hasActionPermission) live
// in lib/auth/rbac.ts and read this map — keep the matrix here.
//
// Matrix (per product spec):
//   OWNER      → everything
//   ADMIN      → everything except owner-only actions (+ Settings, Users)
//   MANAGER    → CRM, Billing, Finance, ERP, Compliance, Inventory
//                (no Users, no Settings, no Payroll)
//   ACCOUNTANT → Billing, Finance, Compliance, Payroll
//                (no CRM, no ERP, no Inventory, no Users, no Settings)
//   STAFF      → CRM, Billing, Inventory (create + edit, no delete)
//                (no Finance/ERP admin, no Users)
//   VIEWER     → read-only Dashboard, CRM, Finance (no writes anywhere)
// ============================================================

import type { Role } from "@prisma/client";

export const rolePermissions: Record<Role, string[]> = {
  // Full access to every module and setting.
  OWNER: ["*"],

  // Full access to every module + Settings + Users management,
  // minus owner-only actions (which live behind the "*" wildcard only).
  ADMIN: [
    "dashboard.read",
    // CRM
    "customers.read",
    "customers.write",
    "customers.delete",
    "leads.read",
    "leads.write",
    "leads.delete",
    // Billing
    "invoices.read",
    "invoices.write",
    "invoices.delete",
    "payments.read",
    "payments.write",
    // Finance
    "finance.read",
    "finance.write",
    "accounting.read",
    "accounting.write",
    "accounting.delete",
    "accounting.export",
    "accounting.post",
    "accounting.manage",
    "loans.read",
    "loans.write",
    // Inventory
    "inventory.read",
    "inventory.write",
    "inventory.delete",
    "items.read",
    "items.write",
    "items.delete",
    // ERP
    "erp.read",
    "erp.write",
    // Compliance
    "compliance.read",
    "compliance.write",
    "compliance.delete",
    "compliance.approve",
    "compliance.audit.read",
    // Tax & Compliance Engine
    "tax.read",
    "tax.write",
    "tax.manage",
    "tax.file",
    "tax.approve",
    // Payroll / HR
    "employees.read",
    "employees.write",
    "payroll.read",
    "payroll.write",
    // Reporting
    "analytics.read",
    // Org administration
    "users.read",
    "users.manage",
    "settings.read",
    "settings.write",
    // Organization Master / KYC (TBX Foundation)
    "organization.read",
    "organization.write",
    // TBX Banking — Balance/Statement/Beneficiary/Payments (Phase 2)
    "banking.read",
    "banking.write",
    "banking.manage",
    "banking.approve",
    // Lending Platform (Phase 3, Module 1) — full control incl. product/
    // approval-matrix configuration
    "lending.read",
    "lending.write",
    "lending.manage",
    "lending.approve",
    "lending.sanction",
    "lending.disburse",
    "lending.collect",
    // Credit Bureau (Phase 3, Module 2)
    "credit.read",
    "credit.pull",
    // AML (Phase 3, Module 3)
    "aml.read",
    "aml.screen",
    "aml.review",
    "aml.approve",
    // Fraud (Phase 3, Module 4)
    "fraud.read",
    "fraud.screen",
    "fraud.review",
    "fraud.approve",
    "fraud.manage",
    // Background Verification (Phase 3, Module 5)
    "verification.read",
    "verification.initiate",
    "verification.review",
    // Continuous Monitoring (Phase 3, Module 6)
    "monitoring.read",
    "monitoring.manage",
  ],

  // CRM, Billing, Finance, ERP, Compliance, Inventory.
  // No Users management, no Settings, no Payroll.
  MANAGER: [
    "dashboard.read",
    // CRM
    "customers.read",
    "customers.write",
    "leads.read",
    "leads.write",
    // Billing
    "invoices.read",
    "invoices.write",
    "payments.read",
    "payments.write",
    // Finance
    "finance.read",
    "accounting.read",
    "accounting.write",
    "accounting.export",
    "accounting.post",
    "loans.read",
    // Inventory
    "inventory.read",
    "inventory.write",
    "items.read",
    "items.write",
    // ERP
    "erp.read",
    "erp.write",
    // Compliance
    "compliance.read",
    "compliance.write",
    "compliance.approve",
    "compliance.audit.read",
    // Tax & Compliance Engine (prepare + file + approve, no rule config)
    "tax.read",
    "tax.write",
    "tax.file",
    "tax.approve",
    // TBX Banking (prepare + approve — checker role, same tier as tax.approve)
    "banking.read",
    "banking.write",
    "banking.approve",
    // Lending Platform (Phase 3, Module 1) — checker tier: approve/sanction/
    // disburse, but no product-catalog or approval-matrix configuration
    "lending.read",
    "lending.write",
    "lending.approve",
    "lending.sanction",
    "lending.disburse",
    "lending.collect",
    // Credit Bureau (Phase 3, Module 2)
    "credit.read",
    "credit.pull",
    // AML (Phase 3, Module 3) — checker tier: can review/approve (resolve cases, file SAR)
    "aml.read",
    "aml.screen",
    "aml.review",
    "aml.approve",
    // Fraud (Phase 3, Module 4) — checker tier: can review/approve/manage blacklist
    "fraud.read",
    "fraud.screen",
    "fraud.review",
    "fraud.approve",
    "fraud.manage",
    // Background Verification (Phase 3, Module 5) — checker tier: can complete/reject cases
    "verification.read",
    "verification.initiate",
    "verification.review",
    // Continuous Monitoring (Phase 3, Module 6) — checker tier: can configure rules, resolve alerts/cases
    "monitoring.read",
    "monitoring.manage",
    // Reporting
    "analytics.read",
  ],

  // Billing, Finance, Compliance, Payroll.
  // No CRM, no ERP, no Inventory, no Users, no Settings.
  ACCOUNTANT: [
    "dashboard.read",
    // Billing
    "invoices.read",
    "invoices.write",
    "payments.read",
    "payments.write",
    // Finance
    "finance.read",
    "finance.write",
    "accounting.read",
    "accounting.write",
    "accounting.export",
    "accounting.post",
    "accounting.manage",
    "loans.read",
    // Compliance
    "compliance.read",
    "compliance.write",
    "compliance.audit.read",
    // Tax & Compliance Engine (prepare + file; approval reserved for ADMIN/MANAGER)
    "tax.read",
    "tax.write",
    "tax.file",
    // TBX Banking (maker role only — approval reserved for ADMIN/MANAGER)
    "banking.read",
    "banking.write",
    // Lending Platform (Phase 3, Module 1) — maker + day-to-day collections
    // ops; approval/sanction/disbursement reserved for ADMIN/MANAGER
    "lending.read",
    "lending.write",
    "lending.collect",
    // Credit Bureau (Phase 3, Module 2)
    "credit.read",
    "credit.pull",
    // AML (Phase 3, Module 3) — maker tier: can trigger screens, not resolve cases
    "aml.read",
    "aml.screen",
    // Fraud (Phase 3, Module 4) — maker tier: can trigger screens, not resolve cases
    "fraud.read",
    "fraud.screen",
    // Background Verification (Phase 3, Module 5) — maker tier: can run checks, not complete cases
    "verification.read",
    "verification.initiate",
    // Continuous Monitoring (Phase 3, Module 6) — read-only; alerts are system-detected, not made by hand
    "monitoring.read",
    // Payroll (if enabled for the org)
    "payroll.read",
    "payroll.write",
    "employees.read",
    // Reporting
    "analytics.read",
  ],

  // CRM, Billing, Inventory — can create + edit, but not delete.
  // No Finance/ERP administration, no Users management.
  STAFF: [
    "dashboard.read",
    // CRM
    "customers.read",
    "customers.write",
    "leads.read",
    "leads.write",
    // Billing
    "invoices.read",
    "invoices.write",
    "payments.read",
    // Inventory
    "inventory.read",
    "inventory.write",
    "items.read",
    "items.write",
  ],

  // Read-only Dashboard, CRM, Finance. No create/edit/delete anywhere.
  VIEWER: [
    "dashboard.read",
    "customers.read",
    "leads.read",
    "finance.read",
    "accounting.read",
    "analytics.read",
    "tax.read",
    "banking.read",
    "lending.read",
    "credit.read",
    "aml.read",
    "fraud.read",
    "verification.read",
    "monitoring.read",
  ],
};
