// ============================================================
// Unit tests — lib/auth/rbac.ts CRUD ⇄ permission expansion
//
// Covers the pure logic the custom-role resolver relies on:
// crudToPermissions() turns a RolePermission row's CRUD flags into
// the flat `<resource>.<action>` strings the guards understand, and
// getModuleMatrix() projects the static matrix into CRUD form.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  crudToPermissions,
  getModuleMatrix,
  getModuleCrudFromList,
  ALL_MODULES,
  hasModuleAccessFromList,
} from "@/lib/auth/rbac";

describe("crudToPermissions", () => {
  it("expands a full-CRUD billing record into every resource action", () => {
    const perms = crudToPermissions("billing", {
      view: true,
      create: true,
      edit: true,
      delete: true,
    });
    // billing → resources [invoices, payments]
    expect(perms).toContain("invoices.read");
    expect(perms).toContain("invoices.write");
    expect(perms).toContain("invoices.delete");
    expect(perms).toContain("payments.read");
    expect(perms).toContain("payments.write");
    expect(perms).toContain("payments.delete");
  });

  it("view-only yields only .read", () => {
    const perms = crudToPermissions("crm", {
      view: true,
      create: false,
      edit: false,
      delete: false,
    });
    expect(perms).toContain("customers.read");
    expect(perms.some((p) => p.endsWith(".write"))).toBe(false);
    expect(perms.some((p) => p.endsWith(".delete"))).toBe(false);
  });

  it("no flags yields no permissions", () => {
    expect(
      crudToPermissions("finance", { view: false, create: false, edit: false, delete: false })
    ).toEqual([]);
  });

  it("round-trips back into module access", () => {
    const perms = crudToPermissions("inventory", {
      view: true,
      create: true,
      edit: false,
      delete: false,
    });
    expect(hasModuleAccessFromList(perms, "inventory")).toBe(true);
    expect(getModuleCrudFromList(perms, "inventory")).toMatchObject({
      view: true,
      create: true,
      edit: true, // create/edit share the .write permission
      delete: false,
    });
  });
});

describe("getModuleMatrix", () => {
  it("returns a CRUD record for every module", () => {
    const matrix = getModuleMatrix("MANAGER");
    for (const m of ALL_MODULES) {
      expect(matrix[m]).toHaveProperty("view");
      expect(matrix[m]).toHaveProperty("delete");
    }
  });

  it("reflects the role matrix (MANAGER: crm yes-no-delete, settings none)", () => {
    const matrix = getModuleMatrix("MANAGER");
    expect(matrix.crm.view).toBe(true);
    expect(matrix.crm.delete).toBe(false);
    expect(matrix.settings.view).toBe(false);
  });
});
