// ============================================================
// FinRP — Onboarding Zod Validators
// ============================================================

import { z } from "zod";

export const organizationDetailsSchema = z.object({
  orgName: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name too long"),
  businessType: z.string().min(1, "Please select a business type"),
  gstNumber: z.string().optional(),
  currency: z.string().min(1, "Please select a currency"),
  timezone: z.string().min(1, "Please select a timezone"),
  logoUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || val === "" || /^https?:\/\/.+/.test(val),
      { message: "Logo URL must start with http:// or https://" }
    ),
  address: z.string().optional(),
});

export const moduleSelectionSchema = z.object({
  enabledModules: z
    .array(
      z.enum([
        "CRM",
        "INVENTORY",
        "ACCOUNTING",
        "HR",
        "BILLING",
        "ANALYTICS",
      ])
    )
    .min(1, "Please select at least one module"),
});

export const singleInviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "STAFF", "VIEWER"]),
});

export const preferencesSchema = z.object({
  theme: z.enum(["dark", "light", "system"]),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  dashboardLayout: z.enum(["default", "compact", "detailed"]),
});

export type OrganizationDetailsInput = z.infer<typeof organizationDetailsSchema>;
export type ModuleSelectionInput = z.infer<typeof moduleSelectionSchema>;
export type SingleInviteInput = z.infer<typeof singleInviteSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
