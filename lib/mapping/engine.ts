// ============================================================
// FinRP — Field Mapping Engine
// Applies MappingRule[] transforms to raw import rows.
// Supports: trim, uppercase, lowercase, dateFormat, numberParse,
// currencyCode, gstNormalize, booleanParse, lookup, split,
// join, constant, default, regex.
// Handles dot-notation for nested target fields.
// ============================================================

import type { MappingRule, TransformFn } from "../connectors/base/types";

// ---------------------------------------------------------------------------
// Mapping context passed to join transform
// ---------------------------------------------------------------------------
interface MappingContext {
  rawRow: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Main mapping engine
// ---------------------------------------------------------------------------

export class MappingEngine {
  // Map a single row using a set of rules
  mapRow(
    rawRow: Record<string, string>,
    rules: MappingRule[]
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    const ctx: MappingContext = { rawRow };

    for (const rule of rules) {
      const rawValue = rawRow[rule.sourceField];

      // Skip entirely if empty and marked so
      if (rule.skipIfEmpty && isEmpty(rawValue)) continue;

      // Use default when source is missing or empty
      const valueToTransform =
        isEmpty(rawValue) && rule.defaultValue !== undefined
          ? rule.defaultValue
          : rawValue ?? "";

      try {
        const transformed = this.applyTransforms(valueToTransform, rule.transforms, ctx);
        setNestedValue(output, rule.targetField, transformed);
      } catch (err) {
        // On transform failure, use empty string so validation catches it
        setNestedValue(output, rule.targetField, "");
        console.warn(
          `MappingEngine: transform failed for ${rule.sourceField} → ${rule.targetField}:`,
          err
        );
      }
    }

    return output;
  }

  // Map multiple rows
  mapRows(
    rawRows: Record<string, string>[],
    rules: MappingRule[]
  ): Record<string, unknown>[] {
    return rawRows.map((row) => this.mapRow(row, rules));
  }

  // ---------------------------------------------------------------------------
  // Apply a chain of transforms to a value
  // ---------------------------------------------------------------------------
  private applyTransforms(
    value: string,
    transforms: TransformFn[],
    ctx: MappingContext
  ): unknown {
    // Track as string through pipeline, final step may cast
    let current: unknown = value;

    for (const transform of transforms) {
      current = this.applyTransform(String(current ?? ""), transform, ctx);
    }

    return current;
  }

  private applyTransform(
    value: string,
    transform: TransformFn,
    ctx: MappingContext
  ): unknown {
    switch (transform.type) {
      case "trim":
        return value.trim();

      case "uppercase":
        return value.toUpperCase().trim();

      case "lowercase":
        return value.toLowerCase().trim();

      case "dateFormat":
        return applyDateFormat(value, transform.fromFormat, transform.toISO);

      case "numberParse":
        return applyNumberParse(value, transform.locale);

      case "currencyCode":
        return normalizeCurrencyCode(value);

      case "gstNormalize":
        return value.toUpperCase().replace(/\s/g, "").trim();

      case "booleanParse":
        return applyBooleanParse(value);

      case "lookup":
        return transform.map[value] ?? transform.map[value.toLowerCase()] ?? value;

      case "split": {
        const parts = value.split(transform.separator);
        return (parts[transform.index] ?? "").trim();
      }

      case "join": {
        const parts = transform.fields.map((f) => (ctx.rawRow[f] ?? "").trim());
        return parts.filter(Boolean).join(transform.separator);
      }

      case "constant":
        return transform.value;

      case "default":
        return isEmpty(value) ? transform.value : value;

      case "regex": {
        const re = new RegExp(transform.pattern, "g");
        return value.replace(re, transform.replacement);
      }

      default:
        return value;
    }
  }
}

// ---------------------------------------------------------------------------
// Transform implementations
// ---------------------------------------------------------------------------

function applyDateFormat(
  value: string,
  fromFormat: string,
  toISO: boolean
): string {
  if (!value.trim()) return "";

  // Try to parse date from known formats
  const trimmed = value.trim();

  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return toISO ? trimmed.slice(0, 10) : trimmed;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    if (fromFormat.startsWith("DD")) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    } else {
      // MM/DD/YYYY
      return `${y}-${d.padStart(2, "0")}-${m.padStart(2, "0")}`;
    }
  }

  // MM/DD/YYYY
  const mdyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (mdyMatch && fromFormat.startsWith("MM")) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // YYYYMMDD (Tally format)
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  // Fallback: let JS parse it
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return trimmed; // Return as-is if unparseable
}

function applyNumberParse(value: string, _locale?: string): number | string {
  if (!value.trim()) return "";

  // Remove currency symbols
  const cleaned = value
    .trim()
    .replace(/[₹$€£¥,]/g, "")
    .replace(/\s/g, "")
    .trim();

  const num = parseFloat(cleaned);
  return isNaN(num) ? value : num;
}

function normalizeCurrencyCode(value: string): string {
  const map: Record<string, string> = {
    "₹": "INR",
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
    "inr": "INR",
    "usd": "USD",
    "eur": "EUR",
    "gbp": "GBP",
  };

  const trimmed = value.trim();
  return map[trimmed] ?? map[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
}

function applyBooleanParse(value: string): boolean {
  const lower = value.toLowerCase().trim();
  const truthy = new Set(["true", "yes", "1", "y", "on", "active", "enabled"]);
  return truthy.has(lower);
}

// ---------------------------------------------------------------------------
// Nested value setter (dot notation: "address.city")
// ---------------------------------------------------------------------------

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function isEmpty(val: string | undefined | null): boolean {
  return val === null || val === undefined || val.trim() === "";
}

// ---------------------------------------------------------------------------
// Rule builder utilities — used by the column mapper UI and auto-suggest
// ---------------------------------------------------------------------------

export function buildDefaultRules(
  sourceHeaders: string[],
  targetFields: string[],
  suggestedMappings: Record<string, string>
): MappingRule[] {
  const rules: MappingRule[] = [];

  for (const sourceField of sourceHeaders) {
    const targetField = suggestedMappings[sourceField];
    if (!targetField || !targetFields.includes(targetField)) continue;

    const transforms = defaultTransformsFor(targetField);

    rules.push({
      sourceField,
      targetField,
      required: isRequiredField(targetField),
      transforms,
      skipIfEmpty: false,
    });
  }

  return rules;
}

function defaultTransformsFor(targetField: string): TransformFn[] {
  const transforms: TransformFn[] = [{ type: "trim" }];

  if (["gstin"].includes(targetField)) {
    transforms.push({ type: "gstNormalize" });
  }
  if (["issueDate", "dueDate", "dateOfBirth", "dateOfJoining"].includes(targetField)) {
    transforms.push({ type: "dateFormat", fromFormat: "DD/MM/YYYY", toISO: true });
  }
  if (["total", "subtotal", "taxAmount", "sellingPrice", "costPrice", "stock", "quantity", "unitPrice"].includes(targetField)) {
    transforms.push({ type: "numberParse" });
  }
  if (["email"].includes(targetField)) {
    transforms.push({ type: "lowercase" });
  }
  if (["currency"].includes(targetField)) {
    transforms.push({ type: "currencyCode" });
  }

  return transforms;
}

function isRequiredField(targetField: string): boolean {
  const required = new Set(["name", "invoiceNumber", "issueDate", "dueDate", "total", "customerName"]);
  return required.has(targetField);
}

// ---------------------------------------------------------------------------
// Export available target fields per entity (for UI dropdowns)
// ---------------------------------------------------------------------------

export const CUSTOMER_TARGET_FIELDS = [
  { field: "name", label: "Customer Name", required: true },
  { field: "email", label: "Email", required: false },
  { field: "phone", label: "Phone", required: false },
  { field: "company", label: "Company Name", required: false },
  { field: "address", label: "Address", required: false },
  { field: "city", label: "City", required: false },
  { field: "state", label: "State", required: false },
  { field: "country", label: "Country", required: false },
  { field: "gstin", label: "GSTIN", required: false },
  { field: "creditLimit", label: "Credit Limit", required: false },
  { field: "notes", label: "Notes", required: false },
];

export const INVOICE_TARGET_FIELDS = [
  { field: "invoiceNumber", label: "Invoice Number", required: true },
  { field: "customerName", label: "Customer Name", required: true },
  { field: "issueDate", label: "Invoice Date", required: true },
  { field: "dueDate", label: "Due Date", required: true },
  { field: "subtotal", label: "Subtotal", required: false },
  { field: "taxAmount", label: "Tax Amount", required: false },
  { field: "total", label: "Total Amount", required: true },
  { field: "currency", label: "Currency", required: false },
  { field: "status", label: "Status", required: false },
  { field: "notes", label: "Notes/Narration", required: false },
];

export const PRODUCT_TARGET_FIELDS = [
  { field: "name", label: "Product Name", required: true },
  { field: "sku", label: "SKU / Item Code", required: false },
  { field: "description", label: "Description", required: false },
  { field: "category", label: "Category", required: false },
  { field: "unit", label: "Unit of Measure", required: false },
  { field: "sellingPrice", label: "Selling Price", required: false },
  { field: "costPrice", label: "Cost Price", required: false },
  { field: "taxRate", label: "Tax Rate (%)", required: false },
  { field: "stock", label: "Opening Stock", required: false },
];
