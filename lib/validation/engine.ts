// ============================================================
// FinRP — Validation Engine
// Validates raw records before they are committed to the DB.
// Rules: field presence, GSTIN format, date logic, stock qty,
// duplicate detection, invoice status consistency.
// ============================================================

import type { ValidationResult, FieldError } from "../connectors/base/types";

// ---------------------------------------------------------------------------
// Regex library
// ---------------------------------------------------------------------------

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\+]?[\d\s\-\(\)]{7,15}$/;
const INVOICE_NO_RE = /^[A-Za-z0-9\-\/]{1,50}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/;

// ---------------------------------------------------------------------------
// Entity-specific schemas
// ---------------------------------------------------------------------------

type Entity = "customer" | "invoice" | "product" | "employee" | "ca_user" | "firm" | "assignment" | "master_import";

interface FieldRule {
  field: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  isDate?: boolean;
  isNumber?: boolean;
  minValue?: number;
  maxValue?: number;
  allowedValues?: string[];
  warnIfMissing?: boolean;       // produces warning instead of error
  validate?: (value: unknown, record: Record<string, unknown>) => FieldError | null;
}

const CUSTOMER_RULES: FieldRule[] = [
  { field: "name", required: true, minLength: 2, maxLength: 200 },
  {
    field: "email",
    pattern: EMAIL_RE,
    patternMessage: "Invalid email format",
    warnIfMissing: true,
  },
  {
    field: "phone",
    pattern: PHONE_RE,
    patternMessage: "Invalid phone number format",
  },
  {
    field: "gstin",
    pattern: GSTIN_RE,
    patternMessage: "Invalid GSTIN format (must be 15-char alphanumeric)",
    validate: (val) => {
      if (!val) return null; // optional field
      const str = String(val).toUpperCase().trim();
      if (!GSTIN_RE.test(str)) {
        return error("gstin", "INVALID_GSTIN", `GSTIN "${str}" is not valid`, val);
      }
      if (!validateGstinChecksum(str)) {
        return error("gstin", "GSTIN_CHECKSUM_FAIL", `GSTIN "${str}" failed checksum validation`, val);
      }
      return null;
    },
  },
];

const INVOICE_RULES: FieldRule[] = [
  { field: "invoiceNumber", required: true, pattern: INVOICE_NO_RE, patternMessage: "Invoice number contains invalid characters" },
  { field: "customerName", required: true, minLength: 1 },
  { field: "issueDate", required: true, isDate: true },
  { field: "dueDate", required: true, isDate: true },
  { field: "total", required: true, isNumber: true, minValue: 0 },
  { field: "subtotal", isNumber: true, minValue: 0 },
  { field: "taxAmount", isNumber: true, minValue: 0 },
  {
    field: "dueDate",
    validate: (val, record) => {
      const issueDate = record["issueDate"];
      if (!val || !issueDate) return null;
      if (new Date(String(val)) < new Date(String(issueDate))) {
        return warn("dueDate", "DUE_BEFORE_ISSUE", "Due date is before issue date", val);
      }
      return null;
    },
  },
  {
    field: "issueDate",
    validate: (val) => {
      if (!val) return null;
      const d = new Date(String(val));
      const now = new Date();
      const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
      const twoYearsLater = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
      if (d < tenYearsAgo) {
        return warn("issueDate", "DATE_VERY_OLD", "Invoice date is more than 10 years ago", val);
      }
      if (d > twoYearsLater) {
        return warn("issueDate", "DATE_FUTURE", "Invoice date is more than 2 years in the future", val);
      }
      return null;
    },
  },
  {
    field: "total",
    validate: (val, record) => {
      const total = Number(val ?? 0);
      const subtotal = Number(record["subtotal"] ?? 0);
      const tax = Number(record["taxAmount"] ?? 0);
      if (subtotal > 0 && Math.abs(total - (subtotal + tax)) > 1) {
        return warn(
          "total",
          "TOTAL_MISMATCH",
          `Total (${total}) doesn't match subtotal (${subtotal}) + tax (${tax}) = ${subtotal + tax}`,
          val
        );
      }
      return null;
    },
  },
];

const PRODUCT_RULES: FieldRule[] = [
  { field: "name", required: true, minLength: 1, maxLength: 200 },
  { field: "sellingPrice", isNumber: true, minValue: 0 },
  { field: "costPrice", isNumber: true, minValue: 0 },
  { field: "stock", isNumber: true, minValue: 0 },
  {
    field: "sellingPrice",
    validate: (val, record) => {
      const selling = Number(val ?? 0);
      const cost = Number(record["costPrice"] ?? 0);
      if (cost > 0 && selling > 0 && selling < cost) {
        return warn(
          "sellingPrice",
          "PRICE_BELOW_COST",
          `Selling price (${selling}) is less than cost price (${cost})`,
          val
        );
      }
      return null;
    },
  },
  {
    field: "taxRate",
    allowedValues: ["0", "5", "12", "18", "28"], // GST slabs
    validate: (val) => {
      if (val === null || val === undefined || val === "") return null;
      const rate = Number(val);
      const validSlabs = [0, 5, 12, 18, 28];
      if (!validSlabs.includes(rate)) {
        return warn(
          "taxRate",
          "NON_STANDARD_GST_SLAB",
          `Tax rate ${rate}% is not a standard GST slab (0/5/12/18/28)`,
          val
        );
      }
      return null;
    },
  },
];

const EMPLOYEE_RULES: FieldRule[] = [
  { field: "name", required: true, minLength: 2, maxLength: 200 },
  {
    field: "email",
    pattern: EMAIL_RE,
    patternMessage: "Invalid email format",
    warnIfMissing: true,
  },
  {
    field: "dateOfBirth",
    isDate: true,
    validate: (val) => {
      if (!val) return null;
      const dob = new Date(String(val));
      const now = new Date();
      const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 18) {
        return error("dateOfBirth", "EMPLOYEE_UNDERAGE", "Employee appears to be under 18", val);
      }
      if (age > 80) {
        return warn("dateOfBirth", "EMPLOYEE_AGE_SUSPICIOUS", "Employee age exceeds 80 years", val);
      }
      return null;
    },
  },
];

const CA_USER_RULES: FieldRule[] = [
  { field: "name", required: true, minLength: 2, maxLength: 200 },
  {
    field: "email",
    required: true,
    pattern: EMAIL_RE,
    patternMessage: "Invalid email format",
  },
  {
    field: "phone",
    pattern: PHONE_RE,
    patternMessage: "Invalid phone number format",
  },
];

const FIRM_RULES: FieldRule[] = [
  { field: "name", required: true, minLength: 2, maxLength: 200 },
  {
    field: "email",
    pattern: EMAIL_RE,
    patternMessage: "Invalid email format",
  },
];

const ASSIGNMENT_RULES: FieldRule[] = [
  {
    field: "caEmail",
    required: true,
    pattern: EMAIL_RE,
    patternMessage: "CA Email must be a valid email",
  },
  {
    field: "customerEmail",
    pattern: EMAIL_RE,
    patternMessage: "Customer Email must be a valid email",
    validate: (val, record) => {
      if (!val && !record["customerCode"]) {
        return error("customerEmail", "CUSTOMER_REF_MISSING", "Either customer_email or customer_code must be provided", val);
      }
      return null;
    },
  },
  {
    field: "startDate",
    isDate: true,
  },
];

const MASTER_IMPORT_RULES: FieldRule[] = [
  { field: "name", required: true, minLength: 2, maxLength: 200 },
  {
    field: "email",
    pattern: EMAIL_RE,
    patternMessage: "Invalid email format",
    warnIfMissing: true,
  },
  {
    field: "gstin",
    pattern: GSTIN_RE,
    patternMessage: "Invalid GSTIN format",
    validate: (val) => {
      if (!val) return null;
      const str = String(val).toUpperCase().trim();
      if (!GSTIN_RE.test(str)) {
        return error("gstin", "INVALID_GSTIN", `GSTIN "${str}" is not valid`, val);
      }
      if (!validateGstinChecksum(str)) {
        return error("gstin", "GSTIN_CHECKSUM_FAIL", `GSTIN "${str}" failed checksum validation`, val);
      }
      return null;
    },
  },
  {
    field: "assignedCaEmail",
    pattern: EMAIL_RE,
    patternMessage: "Assigned CA email must be a valid email address",
  },
];

const ENTITY_RULES: Record<Entity, FieldRule[]> = {
  customer: CUSTOMER_RULES,
  invoice: INVOICE_RULES,
  product: PRODUCT_RULES,
  employee: EMPLOYEE_RULES,
  ca_user: CA_USER_RULES,
  firm: FIRM_RULES,
  assignment: ASSIGNMENT_RULES,
  master_import: MASTER_IMPORT_RULES,
};

// ---------------------------------------------------------------------------
// Validation Engine
// ---------------------------------------------------------------------------

export class ValidationEngine {
  validate(
    record: Record<string, unknown>,
    entity: Entity
  ): ValidationResult {
    const rules = ENTITY_RULES[entity] ?? [];
    const errors: FieldError[] = [];
    const warnings: FieldError[] = [];
    const suggestions: string[] = [];

    for (const rule of rules) {
      const value = record[rule.field];
      const isEmpty = value === null || value === undefined || value === "";

      // Required check
      if (rule.required && isEmpty) {
        errors.push(error(rule.field, "REQUIRED", `Field "${rule.field}" is required`, value));
        continue; // Skip further checks on empty required field
      }

      // Warn if missing (soft required)
      if (rule.warnIfMissing && isEmpty) {
        warnings.push(warn(rule.field, "MISSING", `Field "${rule.field}" is recommended`, value));
        continue;
      }

      if (isEmpty) continue; // All further checks need a value

      const strVal = String(value).trim();

      // Min/max length
      if (rule.minLength !== undefined && strVal.length < rule.minLength) {
        errors.push(error(rule.field, "TOO_SHORT", `"${rule.field}" must be at least ${rule.minLength} characters`, value));
      }
      if (rule.maxLength !== undefined && strVal.length > rule.maxLength) {
        errors.push(error(rule.field, "TOO_LONG", `"${rule.field}" must not exceed ${rule.maxLength} characters`, value));
      }

      // Pattern match
      if (rule.pattern && !rule.pattern.test(strVal)) {
        errors.push(error(rule.field, "PATTERN_MISMATCH", rule.patternMessage ?? `"${rule.field}" has invalid format`, value));
      }

      // Date validation
      if (rule.isDate) {
        if (!ISO_DATE_RE.test(strVal) && isNaN(Date.parse(strVal))) {
          errors.push(error(rule.field, "INVALID_DATE", `"${rule.field}" is not a valid date: ${strVal}`, value));
        }
      }

      // Number validation
      if (rule.isNumber) {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(error(rule.field, "NOT_A_NUMBER", `"${rule.field}" must be a number`, value));
        } else {
          if (rule.minValue !== undefined && num < rule.minValue) {
            errors.push(error(rule.field, "TOO_SMALL", `"${rule.field}" must be >= ${rule.minValue}`, value));
          }
          if (rule.maxValue !== undefined && num > rule.maxValue) {
            errors.push(error(rule.field, "TOO_LARGE", `"${rule.field}" must be <= ${rule.maxValue}`, value));
          }
        }
      }

      // Custom validator (may return error or warning)
      if (rule.validate) {
        const result = rule.validate(value, record);
        if (result) {
          if (result.code.startsWith("WARN_") || isWarnCode(result.code)) {
            warnings.push(result);
          } else {
            errors.push(result);
          }
        }
      }
    }

    // Entity-level suggestions
    if (entity === "customer" || entity === "master_import") {
      if (!record["email"] && !record["phone"]) {
        suggestions.push("Consider providing at least an email or phone for contact purposes");
      }
      if (record["gstin"] && !record["company"]) {
        suggestions.push("GSTIN is provided but no company name — business customers usually have a company name");
      }
    }

    if (entity === "invoice") {
      if (!record["lineItems"] || (record["lineItems"] as unknown[]).length === 0) {
        suggestions.push("Invoice has no line items — consider adding product/service details");
      }
    }

    if (entity === "ca_user") {
      if (!record["icaiNumber"]) {
        suggestions.push("Consider providing the ICAI registration number for CA users");
      }
    }

    if (entity === "assignment") {
      if (!record["serviceType"]) {
        suggestions.push("Specify a service type (e.g. GST Filing, ITR, Audit) for better tracking");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  // ---------------------------------------------------------------------------
  // Batch validate with duplicate detection
  // ---------------------------------------------------------------------------
  validateBatch(
    records: Record<string, unknown>[],
    entity: Entity
  ): Array<ValidationResult & { isDuplicate: boolean; duplicateOf?: number }> {
    const seen = new Map<string, number>(); // deduplication key → first index
    const results: Array<ValidationResult & { isDuplicate: boolean; duplicateOf?: number }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const base = this.validate(record, entity);
      const dedupKey = getDeduplicationKey(record, entity);

      if (dedupKey && seen.has(dedupKey)) {
        results.push({
          ...base,
          isDuplicate: true,
          duplicateOf: seen.get(dedupKey)!,
        });
        base.warnings.push(warn(
          getDeduplicationField(entity),
          "DUPLICATE",
          `Duplicate ${entity} — matches row ${(seen.get(dedupKey)! + 1)}`,
          dedupKey
        ));
      } else {
        if (dedupKey) seen.set(dedupKey, i);
        results.push({ ...base, isDuplicate: false });
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // GSTIN-specific validation (standalone utility)
  // ---------------------------------------------------------------------------
  validateGstin(gstin: string): { valid: boolean; error?: string } {
    const normalized = gstin.toUpperCase().trim();
    if (!GSTIN_RE.test(normalized)) {
      return { valid: false, error: "GSTIN must be 15 alphanumeric characters in the correct format" };
    }
    if (!validateGstinChecksum(normalized)) {
      return { valid: false, error: "GSTIN checksum digit is incorrect" };
    }
    return { valid: true };
  }

  // ---------------------------------------------------------------------------
  // Invoice date validation (standalone utility)
  // ---------------------------------------------------------------------------
  validateInvoiceDates(
    issueDate: string,
    dueDate: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const issue = new Date(issueDate);
    const due = new Date(dueDate);

    if (isNaN(issue.getTime())) errors.push("Issue date is not a valid date");
    if (isNaN(due.getTime())) errors.push("Due date is not a valid date");
    if (!isNaN(issue.getTime()) && !isNaN(due.getTime()) && due < issue) {
      errors.push("Due date cannot be before the issue date");
    }

    return { valid: errors.length === 0, errors };
  }
}

// ---------------------------------------------------------------------------
// GSTIN Checksum (Luhn-based mod-36)
// ---------------------------------------------------------------------------

function validateGstinChecksum(gstin: string): boolean {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;

  for (let i = 0; i < 14; i++) {
    const charIndex = chars.indexOf(gstin[i]);
    if (charIndex === -1) return false;

    const product = charIndex * ((i % 2 === 0) ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }

  const remainder = sum % 36;
  const checkChar = chars[(36 - remainder) % 36];
  return checkChar === gstin[14];
}

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

function getDeduplicationKey(
  record: Record<string, unknown>,
  entity: Entity
): string | null {
  switch (entity) {
    case "customer":
      return (
        (record["email"] as string | undefined)?.toLowerCase().trim() ||
        (record["gstin"] as string | undefined)?.toUpperCase().trim() ||
        null
      );
    case "invoice":
      return (record["invoiceNumber"] as string | undefined)?.trim() ?? null;
    case "product":
      return (
        (record["sku"] as string | undefined)?.trim() ||
        (record["name"] as string | undefined)?.toLowerCase().trim() ||
        null
      );
    case "employee":
    case "ca_user":
      return (
        (record["email"] as string | undefined)?.toLowerCase().trim() ||
        null
      );
    case "firm":
      return (
        (record["registrationNumber"] as string | undefined)?.toUpperCase().trim() ||
        (record["name"] as string | undefined)?.toLowerCase().trim() ||
        null
      );
    case "assignment":
      return [
        (record["caEmail"] as string | undefined)?.toLowerCase().trim() ?? "",
        (record["customerEmail"] as string | undefined)?.toLowerCase().trim() ??
          (record["customerCode"] as string | undefined)?.trim() ?? "",
      ].join("|") || null;
    case "master_import":
      return (
        (record["email"] as string | undefined)?.toLowerCase().trim() ||
        (record["customerCode"] as string | undefined)?.trim() ||
        null
      );
    default:
      return null;
  }
}

function getDeduplicationField(entity: Entity): string {
  switch (entity) {
    case "customer":
    case "master_import": return "email";
    case "invoice": return "invoiceNumber";
    case "product": return "sku";
    case "employee":
    case "ca_user": return "email";
    case "firm": return "registrationNumber";
    case "assignment": return "caEmail";
    default: return "id";
  }
}

// ---------------------------------------------------------------------------
// Factory helpers for FieldError
// ---------------------------------------------------------------------------

const WARN_CODES = new Set([
  "DUE_BEFORE_ISSUE", "DATE_VERY_OLD", "DATE_FUTURE", "TOTAL_MISMATCH",
  "PRICE_BELOW_COST", "NON_STANDARD_GST_SLAB", "MISSING", "DUPLICATE",
  "EMPLOYEE_AGE_SUSPICIOUS",
]);

function isWarnCode(code: string): boolean {
  return WARN_CODES.has(code);
}

function error(
  field: string,
  code: string,
  message: string,
  value?: unknown
): FieldError {
  return { field, code, message, value };
}

function warn(
  field: string,
  code: string,
  message: string,
  value?: unknown
): FieldError {
  return { field, code: `WARN_${code}`, message, value };
}
