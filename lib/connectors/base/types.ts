// ============================================================
// FinRP — Connector Type System
// Shared types used by every connector implementation.
// ============================================================

// ---------------------------------------------------------------------------
// Raw source records (after extraction, before transformation)
// ---------------------------------------------------------------------------
export interface RawCustomer {
  externalId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  gstin?: string;
  customerType?: string;
  creditLimit?: string | number;
  tags?: string[];
  notes?: string;
  [key: string]: unknown; // allow extra fields
}

export interface RawInvoice {
  externalId: string;
  invoiceNumber: string;
  customerExternalId?: string;
  customerName?: string;
  issueDate: string;
  dueDate: string;
  status: string;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  currency: string;
  notes?: string;
  lineItems: RawLineItem[];
  [key: string]: unknown;
}

export interface RawLineItem {
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  taxPercent?: string | number;
  amount?: string | number;
  [key: string]: unknown;
}

export interface RawProduct {
  externalId: string;
  sku?: string;
  name: string;
  description?: string;
  category?: string;
  costPrice?: string | number;
  sellingPrice?: string | number;
  taxRate?: string | number;
  stock?: string | number;
  unit?: string;
  [key: string]: unknown;
}

export interface RawEmployee {
  externalId: string;
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string;
  dateOfJoining?: string;
  baseSalary?: string | number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Extraction result
// ---------------------------------------------------------------------------
export interface ExtractionResult<T> {
  records: T[];
  totalCount: number;
  nextCursor?: string;     // for pagination / incremental sync
  hasMore: boolean;
  sourceInfo: {
    connectorType: string;
    extractedAt: Date;
    queryParams?: Record<string, string>;
  };
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------
export interface FieldError {
  field: string;
  code: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  warnings: FieldError[];
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Field mapping rule
// ---------------------------------------------------------------------------
export type TransformFn =
  | { type: "trim" }
  | { type: "uppercase" }
  | { type: "lowercase" }
  | { type: "dateFormat"; fromFormat: string; toISO: boolean }
  | { type: "numberParse"; locale?: string }
  | { type: "currencyCode" }
  | { type: "gstNormalize" }
  | { type: "booleanParse" }
  | { type: "lookup"; map: Record<string, string> }
  | { type: "split"; separator: string; index: number }
  | { type: "join"; fields: string[]; separator: string }
  | { type: "constant"; value: string }
  | { type: "default"; value: string }
  | { type: "regex"; pattern: string; replacement: string };

export interface MappingRule {
  sourceField: string;      // CSV column or API field name
  targetField: string;      // Our DB field name (dot-notation for nested)
  required: boolean;
  transforms: TransformFn[];
  defaultValue?: string;
  skipIfEmpty?: boolean;
}

// ---------------------------------------------------------------------------
// Sync metadata for incremental sync
// ---------------------------------------------------------------------------
export interface SyncCursor {
  lastModifiedAt?: string;    // ISO date
  pageToken?: string;
  offset?: number;
  entityType?: string;
}

// ---------------------------------------------------------------------------
// Connection config types
// ---------------------------------------------------------------------------
export interface ZohoConfig {
  dataCenter: "IN" | "US" | "EU" | "AU" | "JP" | "CN";
  clientId: string;
  clientSecret: string;
  accountId?: string;
}

export interface OdooConfig {
  baseUrl: string;            // e.g. https://mycompany.odoo.com
  database: string;           // Odoo database name
  username: string;
  password: string;           // password or API key (Odoo 14+ accepts API key as password)
  apiKey?: string;            // explicit API key override for Odoo 14+
}

export interface TallyConfig {
  /** Tally Bridge agent URL (cloud proxy). When set, host/port are ignored. */
  bridgeUrl?: string;
  bridgeApiKey?: string;
  /** Direct Tally connection (on-premise LAN) */
  host?: string;              // default: localhost
  port?: number;              // default: 9000
  companyName?: string;
}

export interface CsvConfig {
  delimiter?: string;
  hasHeader: boolean;
  encoding?: string;
  skipRows?: number;
}

// ---------------------------------------------------------------------------
// Connector test result
// ---------------------------------------------------------------------------
export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  details?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Sync stats
// ---------------------------------------------------------------------------
export interface SyncStats {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  merged: number;
  nextCursor?: string;
}
