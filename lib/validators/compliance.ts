// ============================================================
// FinRP — Compliance Module Zod Validators
// ============================================================

import { z } from "zod";

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const ComplianceCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, numbers, or underscores")
    .transform((v) => v.toUpperCase()),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
    .default("#6366f1"),
  icon: z.string().max(50).default("ShieldCheck"),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateComplianceCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const ComplianceTypeSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  code: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, numbers, or underscores")
    .transform((v) => v.toUpperCase()),
  requiredDocuments: z.array(z.string().max(100)).default([]),
  validityDays: z.number().int().min(1).optional(),
  defaultPenalty: z.number().min(0).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const UpdateComplianceTypeSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  requiredDocuments: z.array(z.string()).optional(),
  validityDays: z.number().int().min(1).optional().nullable(),
  defaultPenalty: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const ComplianceStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "PENDING_RENEWAL",
]);

export const ComplianceSubmissionSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  typeId: z.string().optional().nullable(),
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(2000).optional().nullable(),
  referenceNumber: z.string().max(100).optional().nullable(),
  status: ComplianceStatusEnum.optional(),
  submissionDate: z.string().datetime().optional().nullable(),
  effectiveDate: z.string().datetime().optional().nullable(),
  expiryDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  renewalDate: z.string().datetime().optional().nullable(),
  penaltyAmount: z.number().min(0).optional().nullable(),
  feeAmount: z.number().min(0).optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  complianceData: z.record(z.string(), z.unknown()).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  notes: z.string().max(2000).optional().nullable(),
});

export const UpdateComplianceSubmissionSchema = ComplianceSubmissionSchema.partial().extend({
  reviewedById: z.string().optional().nullable(),
});

export const ApproveComplianceSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES", "ESCALATE"]),
  comments: z.string().max(1000).optional(),
  conditions: z.string().max(1000).optional(),
});

export const ComplianceReminderSchema = z.object({
  submissionId: z.string().optional().nullable(),
  type: z.enum([
    "DUE_DATE",
    "EXPIRY",
    "PENDING_APPROVAL",
    "REJECTED_FOLLOW_UP",
    "RENEWAL",
    "CUSTOM",
  ]),
  title: z.string().min(2).max(200),
  message: z.string().max(1000).optional(),
  reminderDate: z.string().datetime("Must be a valid ISO datetime"),
  assignedToId: z.string().optional().nullable(),
});

export const SubmissionsQuerySchema = z.object({
  status: ComplianceStatusEnum.optional(),
  categoryId: z.string().optional(),
  typeId: z.string().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "dueDate", "expiryDate", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z.coerce.boolean().default(false),
});

export const validateGST = (value: string): boolean =>
  GST_REGEX.test(value.trim().toUpperCase());

export const validatePAN = (value: string): boolean =>
  PAN_REGEX.test(value.trim().toUpperCase());

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
