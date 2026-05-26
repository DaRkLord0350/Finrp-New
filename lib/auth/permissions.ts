// ============================================================
// lib/auth/permissions.ts
// Enterprise-grade role-based access control permission map.
// ============================================================

import { Role } from "@prisma/client";

/**
 * Permission matrix mapping roles to their allowed actions.
 * Uses module.action naming convention: e.g., customers.read, invoices.approve
 *
 * CRITICAL SECURITY:
 * - Never modify this based on frontend input
 * - This is the source of truth for authorization
 * - All API/page access must validate against this matrix
 * - Always verify organizationId on backend operations
 */
export const rolePermissions: Record<Role, string[]> = {
  // Platform-level super admin. Not organization scoped.
  // Can access all organizations, billing, audit logs, system settings.
  SUPER_ADMIN: ["*"],

  // Organization owner/admin.
  // Full access within their organization.
  ADMIN: [
    // Dashboard & Analytics
    "dashboard.read",
    "analytics.read",
    "reports.export",

    // Customer Management
    "customers.read",
    "customers.write",
    "customers.delete",

    // Invoice & Finance Operations
    "invoices.read",
    "invoices.write",
    "invoices.approve",
    "invoices.delete",
    "payments.read",
    "payments.write",

    // Finance & Accounting
    "finance.read",
    "finance.write",
    "journal.read",
    "journal.write",

    // ERP & Inventory
    "inventory.read",
    "inventory.write",
    "inventory.delete",
    "erp.read",
    "erp.write",

    // Compliance & Tax
    "compliance.read",
    "compliance.write",
    "compliance.approve",

    // HR & Payroll
    "employees.read",
    "employees.write",
    "payroll.read",
    "payroll.write",

    // Loans
    "loans.read",
    "loans.write",

    // User Management
    "users.read",
    "users.write",
    "users.delete",

    // Settings
    "settings.read",
    "settings.write",
  ],

  // Chartered Accountant.
  // Finance, tax, and compliance focused role.
  CA: [
    // Dashboard & Analytics
    "dashboard.read",
    "analytics.read",
    "reports.export",

    // Read-only customer access
    "customers.read",

    // Invoice verification & approval
    "invoices.read",
    "invoices.write",
    "invoices.approve",

    // Payment processing & tracking
    "payments.read",
    "payments.write",

    // Core finance & accounting
    "finance.read",
    "finance.write",
    "journal.read",
    "journal.write",

    // Tax & Compliance (primary role)
    "compliance.read",
    "compliance.write",
    "compliance.approve",

    // ERP & Accounting reports
    "erp.read",

    // Loan management & CMA
    "loans.read",

    // Payroll review (read-only)
    "payroll.read",

    // Cannot: user management, delete operations, settings
  ],

  // Accountant.
  // Daily finance and accounting operations.
  ACCOUNTANT: [
    // Dashboard
    "dashboard.read",
    "analytics.read",

    // Customer ledger
    "customers.read",

    // Invoice & payment entry
    "invoices.read",
    "invoices.write",
    "payments.read",
    "payments.write",

    // Finance operations
    "finance.read",
    "finance.write",
    "journal.read",
    "journal.write",

    // ERP operations
    "erp.read",
    "erp.write",

    // Payroll operations
    "payroll.read",
    "payroll.write",

    // Loan tracking
    "loans.read",

    // Compliance view (no approval)
    "compliance.read",

    // Cannot: approve invoices/compliance, manage users, delete, export, settings
  ],

  // Staff / Operational Employee.
  // Day-to-day operational tasks.
  STAFF: [
    // Dashboard
    "dashboard.read",

    // Customer operations
    "customers.read",
    "customers.write",

    // Invoice viewing & management
    "invoices.read",

    // Inventory operations
    "inventory.read",
    "inventory.write",

    // ERP operations
    "erp.read",

    // Compliance view (no write)
    "compliance.read",

    // Cannot: approve, delete, finance operations, user management, settings, exports
  ],

  // Viewer / Read-only role.
  // Reports and analytics access only. No modifications.
  VIEWER: [
    // Dashboard & reports
    "dashboard.read",
    "analytics.read",
    "reports.export",

    // Read-only access to core modules
    "customers.read",
    "finance.read",
    "invoices.read",
    "compliance.read",

    // Cannot: write/delete anything, approve, manage users
  ],
};
