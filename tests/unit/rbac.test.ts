// ============================================================
// Unit tests — lib/auth/rbac.ts
//
// Encodes the product permission matrix and the RBAC acceptance
// tests (an ACCOUNTANT sees only allowed modules, a VIEWER is
// read-only, an OWNER is unrestricted, etc.). If the matrix in
// lib/auth/permissions.ts drifts, these fail loudly.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  hasModuleAccess,
  hasActionPermission,
  permissionsFor,
  canView,
  canCreate,
  canEdit,
  canDelete,
  type AppModule,
} from "@/lib/auth/rbac";
import type { Role } from "@prisma/client";

const ALL_MODULES: AppModule[] = [
  "dashboard",
  "crm",
  "billing",
  "finance",
  "accounting",
  "erp",
  "inventory",
  "compliance",
  "payroll",
  "banking",
  "reports",
  "settings",
  "users",
];

describe("OWNER", () => {
  it("has unrestricted module + action access", () => {
    for (const m of ALL_MODULES) {
      expect(hasModuleAccess("OWNER", m)).toBe(true);
    }
    expect(hasActionPermission("OWNER", "anything", "delete")).toBe(true);
    expect(hasActionPermission("OWNER", "settings", "write")).toBe(true);
  });
});

describe("ADMIN", () => {
  it("manages users + settings, has all business modules", () => {
    for (const m of ["crm", "billing", "finance", "erp", "compliance", "inventory", "settings", "users"] as AppModule[]) {
      expect(hasModuleAccess("ADMIN", m)).toBe(true);
    }
    expect(hasActionPermission("ADMIN", "users", "manage")).toBe(true);
  });
});

describe("MANAGER", () => {
  it("has CRM/Billing/Finance/ERP/Compliance/Inventory", () => {
    for (const m of ["dashboard", "crm", "billing", "finance", "erp", "compliance", "inventory"] as AppModule[]) {
      expect(hasModuleAccess("MANAGER", m)).toBe(true);
    }
  });

  it("has NO Payroll, NO Users, NO Settings", () => {
    expect(hasModuleAccess("MANAGER", "payroll")).toBe(false);
    expect(hasModuleAccess("MANAGER", "users")).toBe(false);
    expect(hasModuleAccess("MANAGER", "settings")).toBe(false);
  });
});

describe("ACCOUNTANT", () => {
  it("has Dashboard/Billing/Finance/Compliance/Payroll", () => {
    for (const m of ["dashboard", "billing", "finance", "compliance", "payroll"] as AppModule[]) {
      expect(hasModuleAccess("ACCOUNTANT", m)).toBe(true);
    }
  });

  it("has NO CRM, NO ERP, NO Inventory, NO Users, NO Settings", () => {
    expect(hasModuleAccess("ACCOUNTANT", "crm")).toBe(false);
    expect(hasModuleAccess("ACCOUNTANT", "erp")).toBe(false);
    expect(hasModuleAccess("ACCOUNTANT", "inventory")).toBe(false);
    expect(hasModuleAccess("ACCOUNTANT", "users")).toBe(false);
    expect(hasModuleAccess("ACCOUNTANT", "settings")).toBe(false);
  });
});

describe("STAFF", () => {
  it("can create/edit in CRM, Billing, Inventory", () => {
    expect(hasActionPermission("STAFF", "customers", "write")).toBe(true);
    expect(hasActionPermission("STAFF", "invoices", "write")).toBe(true);
    expect(hasActionPermission("STAFF", "inventory", "write")).toBe(true);
    for (const m of ["dashboard", "crm", "billing", "inventory"] as AppModule[]) {
      expect(hasModuleAccess("STAFF", m)).toBe(true);
    }
  });

  it("cannot delete, and has NO Finance/ERP/Users/Settings", () => {
    expect(hasActionPermission("STAFF", "customers", "delete")).toBe(false);
    expect(hasModuleAccess("STAFF", "finance")).toBe(false);
    expect(hasModuleAccess("STAFF", "erp")).toBe(false);
    expect(hasModuleAccess("STAFF", "users")).toBe(false);
    expect(hasModuleAccess("STAFF", "settings")).toBe(false);
  });
});

describe("VIEWER", () => {
  it("can read Dashboard, CRM, Finance", () => {
    expect(hasModuleAccess("VIEWER", "dashboard")).toBe(true);
    expect(hasModuleAccess("VIEWER", "crm")).toBe(true);
    expect(hasModuleAccess("VIEWER", "finance")).toBe(true);
  });

  it("has NO write/delete anywhere", () => {
    const viewerPerms = permissionsFor("VIEWER");
    for (const p of viewerPerms) {
      expect(p.endsWith(".write")).toBe(false);
      expect(p.endsWith(".delete")).toBe(false);
      expect(p.endsWith(".manage")).toBe(false);
    }
    expect(hasActionPermission("VIEWER", "customers", "write")).toBe(false);
    expect(hasActionPermission("VIEWER", "invoices", "write")).toBe(false);
    // No Billing/ERP/Inventory/Compliance/Users
    expect(hasModuleAccess("VIEWER", "billing")).toBe(false);
    expect(hasModuleAccess("VIEWER", "erp")).toBe(false);
    expect(hasModuleAccess("VIEWER", "users")).toBe(false);
  });
});

describe("CRUD-granular helpers (module vs action)", () => {
  it("ADMIN can view/create/edit/delete CRM", () => {
    expect(canView("ADMIN", "crm")).toBe(true);
    expect(canCreate("ADMIN", "crm")).toBe(true);
    expect(canEdit("ADMIN", "crm")).toBe(true);
    expect(canDelete("ADMIN", "crm")).toBe(true);
  });

  it("MANAGER can create/edit but NOT delete CRM", () => {
    expect(canView("MANAGER", "crm")).toBe(true);
    expect(canCreate("MANAGER", "crm")).toBe(true);
    expect(canEdit("MANAGER", "crm")).toBe(true);
    expect(canDelete("MANAGER", "crm")).toBe(false);
  });

  it("STAFF can create/edit billing but not delete", () => {
    expect(canCreate("STAFF", "billing")).toBe(true);
    expect(canEdit("STAFF", "billing")).toBe(true);
    expect(canDelete("STAFF", "billing")).toBe(false);
  });

  it("VIEWER can only view finance — no create/edit/delete", () => {
    expect(canView("VIEWER", "finance")).toBe(true);
    expect(canCreate("VIEWER", "finance")).toBe(false);
    expect(canEdit("VIEWER", "finance")).toBe(false);
    expect(canDelete("VIEWER", "finance")).toBe(false);
  });

  it("ACCOUNTANT has no CRM CRUD at all", () => {
    expect(canView("ACCOUNTANT", "crm")).toBe(false);
    expect(canCreate("ACCOUNTANT", "crm")).toBe(false);
    expect(canDelete("ACCOUNTANT", "crm")).toBe(false);
  });

  it("OWNER can do everything", () => {
    expect(canDelete("OWNER", "settings")).toBe(true);
    expect(canCreate("OWNER", "users")).toBe(true);
  });
});

describe("null / unknown role", () => {
  it("has no access", () => {
    const none = null as unknown as Role;
    expect(hasModuleAccess(none, "dashboard")).toBe(false);
    expect(hasActionPermission(none, "customers", "read")).toBe(false);
    expect(permissionsFor(none)).toEqual([]);
  });
});
