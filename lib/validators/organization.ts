// ============================================================
// lib/validators/organization.ts
// Zod schemas + inferred DTOs for Module 1 (Organization Master,
// Branches, Departments). Verification-status / TBX id fields are
// deliberately NOT included in the update schemas — those are
// system-managed by lib/tbx/service.ts + lib/services/kyc-status
// .service.ts, never settable directly by a user request.
// ============================================================

import { z } from "zod";

export const UpdateOrganizationMasterSchema = z.object({
  businessName: z.string().trim().min(1).max(200).optional(),
  businessType: z.string().trim().max(100).optional().nullable(),
  industry: z.string().trim().max(100).optional().nullable(),
  companySize: z.string().trim().max(50).optional().nullable(),

  gstin: z.string().trim().max(15).optional().nullable(),
  pan: z.string().trim().max(10).optional().nullable(),
  cin: z.string().trim().max(21).optional().nullable(),
  msmeRegistrationNo: z.string().trim().max(50).optional().nullable(),
  msmeCategory: z.enum(["MICRO", "SMALL", "MEDIUM"]).optional().nullable(),

  // Registered address (existing BusinessProfile fields)
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  pincode: z.string().trim().max(20).optional().nullable(),

  // Operational address — only set when it differs from the registered one
  operationalAddress: z
    .object({
      address: z.string().trim().max(500).optional(),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(100).optional(),
      country: z.string().trim().max(100).optional(),
      pincode: z.string().trim().max(20).optional(),
    })
    .optional()
    .nullable(),

  currency: z.string().trim().length(3).optional(),
  timezone: z.string().trim().max(50).optional(),
  fiscalYearType: z.enum(["APRIL_MARCH", "JANUARY_DECEMBER"]).optional(),

  defaultBankAccountId: z.string().trim().min(1).optional().nullable(),
});
export type UpdateOrganizationMasterInput = z.infer<typeof UpdateOrganizationMasterSchema>;

const branchFields = {
  name: z.string().trim().min(1).max(200),
  branchCode: z.string().trim().max(50).optional().nullable(),
  gstin: z.string().trim().max(15).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  pincode: z.string().trim().max(20).optional().nullable(),
  isHeadOffice: z.boolean().optional(),
  isActive: z.boolean().optional(),
};

export const CreateOrgBranchSchema = z.object(branchFields);
export type CreateOrgBranchInput = z.infer<typeof CreateOrgBranchSchema>;

export const UpdateOrgBranchSchema = z.object(branchFields).partial();
export type UpdateOrgBranchInput = z.infer<typeof UpdateOrgBranchSchema>;

const departmentFields = {
  name: z.string().trim().min(1).max(200),
  headUserId: z.string().trim().min(1).optional().nullable(),
  parentDepartmentId: z.string().trim().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
};

export const CreateOrgDepartmentSchema = z.object(departmentFields);
export type CreateOrgDepartmentInput = z.infer<typeof CreateOrgDepartmentSchema>;

export const UpdateOrgDepartmentSchema = z.object(departmentFields).partial();
export type UpdateOrgDepartmentInput = z.infer<typeof UpdateOrgDepartmentSchema>;
