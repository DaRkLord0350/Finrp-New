import { Role } from "@prisma/client";

export const rolePermissions: Record<Role, string[]> = {
  OWNER: ["*"],

  ADMIN: [
    "dashboard.read",
    "customers.read",
    "customers.write",
    "finance.read",
    "finance.write",
    "inventory.read",
    "inventory.write",
  ],

  MANAGER: [
    "dashboard.read",
    "customers.read",
    "finance.read",
    "inventory.read",
  ],

  ACCOUNTANT: [
    "finance.read",
    "finance.write",
    "expenses.read",
    "expenses.write",
    "invoice.read",
    "invoice.write",
  ],

  STAFF: [
    "dashboard.read",
    "customers.read",
  ],

  VIEWER: [
    "dashboard.read",
    "finance.read",
  ],
};