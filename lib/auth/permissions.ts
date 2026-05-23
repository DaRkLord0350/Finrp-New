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
    "loans.read",
    "inventory.read",
    "inventory.write",
    "erp.read",
    "compliance.read",
    "employees.read",
    "payroll.read",
    "analytics.read",
  ],

  ACCOUNTANT: [
    "dashboard.read",
    "finance.read",
    "finance.write",
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
  ],

  STAFF: [
    "dashboard.read",
    "customers.read",
    "invoices.read",
    "inventory.read",
    "compliance.read",
  ],

  VIEWER: [
    "dashboard.read",
    "customers.read",
    "finance.read",
    "analytics.read",
  ],
};
