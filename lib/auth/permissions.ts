// ============================================================
// lib/auth/permissions.ts
// Role-based access control permission map.
// ============================================================

import { Role } from "@prisma/client";

export const rolePermissions: Record<Role, string[]> = {
  OWNER: ["*"],

  ADMIN: [
    "dashboard.read",
    "customers.read",
    "customers.write",
    "customers.delete",
    "invoices.read",
    "invoices.write",
    "invoices.delete",
    "payments.read",
    "payments.write",
    "finance.read",
    "finance.write",
    // Chart of Accounts — full access (spec: SUPER_ADMIN)
    "accounting.read",
    "accounting.write",
    "accounting.delete",
    "accounting.export",
    "loans.read",
    "loans.write",
    "inventory.read",
    "inventory.write",
    "inventory.delete",
    "erp.read",
    "erp.write",
    "compliance.read",
    "compliance.write",
    "compliance.delete",
    "compliance.approve",
    "compliance.audit.read",
    "employees.read",
    "employees.write",
    "payroll.read",
    "payroll.write",
    "analytics.read",
    "settings.read",
    "settings.write",
  ],

  MANAGER: [
    "dashboard.read",
    "customers.read",
    "customers.write",
    "invoices.read",
    "invoices.write",
    "payments.read",
    "finance.read",
    // Chart of Accounts — create/edit/view/export (spec: CA)
    "accounting.read",
    "accounting.write",
    "accounting.export",
    "loans.read",
    "inventory.read",
    "inventory.write",
    "erp.read",
    "compliance.read",
    "compliance.write",
    "compliance.approve",
    "compliance.audit.read",
    "employees.read",
    "payroll.read",
    "analytics.read",
  ],

  ACCOUNTANT: [
    "dashboard.read",
    "finance.read",
    "finance.write",
    // Chart of Accounts — create/edit/view (spec: ACCOUNTANT)
    "accounting.read",
    "accounting.write",
    "invoices.read",
    "invoices.write",
    "payments.read",
    "payments.write",
    "loans.read",
    "erp.read",
    "erp.write",
    "analytics.read",
    "payroll.read",
    "payroll.write",
    "compliance.read",
    "compliance.audit.read",
  ],

  STAFF: [
    "dashboard.read",
    "customers.read",
    "invoices.read",
    "inventory.read",
    "compliance.read",
    // Chart of Accounts — view only (spec: CLIENT)
    "accounting.read",
  ],

  VIEWER: [
    "dashboard.read",
    "customers.read",
    "finance.read",
    "analytics.read",
    // Chart of Accounts — view only (spec: CLIENT)
    "accounting.read",
  ],
};
