// ============================================================
// FinRP — Odoo Connector
// Uses Odoo JSON-RPC (/web/dataset/call_kw).
// Authenticates via common.authenticate(), then fetches:
//   - res.partner        → Customers
//   - account.move       → Invoices
//   - product.template   → Products
//   - hr.employee        → Employees
// Supports both on-premise and Odoo.sh / cloud deployments.
// ============================================================

import { BaseConnector } from "../base/connector";
import type {
  ConnectionTestResult,
  ExtractionResult,
  RawCustomer,
  RawInvoice,
  RawProduct,
  RawEmployee,
  SyncCursor,
  SyncStats,
  ValidationResult,
  OdooConfig,
} from "../base/types";
import { ValidationEngine } from "@/lib/validation/engine";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Odoo JSON-RPC Types
// ---------------------------------------------------------------------------

interface OdooRPCRequest {
  jsonrpc: "2.0";
  method: "call";
  id: number;
  params: {
    service: string;
    method: string;
    args: unknown[];
  };
}

interface OdooRPCResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data: { name: string; debug: string; message: string };
  };
}

// Domain filter DSL — Odoo uses lists of triples
type OdooDomain = Array<[string, string, unknown] | string>;

interface OdooSearchReadParams {
  model: string;
  domain: OdooDomain;
  fields: string[];
  limit?: number;
  offset?: number;
  order?: string;
  context?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Odoo JSON-RPC client
// ---------------------------------------------------------------------------

let _rpcIdCounter = 1;

async function odooRpc<T = unknown>(
  baseUrl: string,
  service: string,
  method: string,
  args: unknown[]
): Promise<T> {
  const requestBody: OdooRPCRequest = {
    jsonrpc: "2.0",
    method: "call",
    id: _rpcIdCounter++,
    params: { service, method, args },
  };

  const res = await fetch(`${baseUrl}/web/dataset/call_kw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    throw new Error(`Odoo HTTP error ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as OdooRPCResponse<T>;

  if (data.error) {
    throw new Error(
      `Odoo RPC error: ${data.error.data?.message ?? data.error.message}`
    );
  }

  return data.result as T;
}

// Authenticate — returns uid
async function odooAuthenticate(
  baseUrl: string,
  db: string,
  username: string,
  password: string
): Promise<number> {
  const uid = await odooRpc<number>(baseUrl, "common", "authenticate", [
    db,
    username,
    password,
    {},
  ]);

  if (!uid || uid <= 0) {
    throw new Error("Odoo authentication failed: invalid credentials or database");
  }

  return uid;
}

// search_read wrapper
async function odooSearchRead<T = Record<string, unknown>>(
  baseUrl: string,
  db: string,
  uid: number,
  password: string,
  params: OdooSearchReadParams
): Promise<T[]> {
  return odooRpc<T[]>(baseUrl, "object", "execute_kw", [
    db,
    uid,
    password,
    params.model,
    "search_read",
    [params.domain],
    {
      fields: params.fields,
      limit: params.limit ?? 200,
      offset: params.offset ?? 0,
      order: params.order ?? "id asc",
      context: params.context ?? {},
    },
  ]);
}

// Paginate all records
async function odooFetchAll<T = Record<string, unknown>>(
  baseUrl: string,
  db: string,
  uid: number,
  password: string,
  params: Omit<OdooSearchReadParams, "offset">
): Promise<T[]> {
  const all: T[] = [];
  const pageSize = params.limit ?? 200;
  let offset = 0;

  while (true) {
    const page = await odooSearchRead<T>(baseUrl, db, uid, password, {
      ...params,
      limit: pageSize,
      offset,
    });
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
    await delay(100); // polite rate limiting
  }

  return all;
}

// ---------------------------------------------------------------------------
// Odoo raw record shapes
// ---------------------------------------------------------------------------

interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  mobile: string | false;
  street: string | false;
  street2: string | false;
  city: string | false;
  state_id: [number, string] | false;
  country_id: [number, string] | false;
  vat: string | false;                  // GSTIN
  company_type: "person" | "company";
  company_name: string | false;
  customer_rank: number;
  write_date: string;
}

interface OdooAccountMove {
  id: number;
  name: string;                         // invoice number
  partner_id: [number, string] | false;
  invoice_date: string | false;
  invoice_date_due: string | false;
  state: "draft" | "posted" | "cancel";
  payment_state: "not_paid" | "in_payment" | "paid" | "partial" | "reversed" | "invoicing_legacy";
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  amount_residual: number;
  currency_id: [number, string];
  narration: string | false;
  write_date: string;
  move_type: string;
  invoice_line_ids: number[];
}

interface OdooAccountMoveLine {
  id: number;
  name: string;
  quantity: number;
  price_unit: number;
  tax_ids: number[];
  price_subtotal: number;
}

interface OdooProductTemplate {
  id: number;
  name: string;
  default_code: string | false;       // SKU
  description: string | false;
  categ_id: [number, string] | false;
  uom_id: [number, string] | false;
  standard_price: number;
  list_price: number;
  taxes_id: number[];
  qty_available: number;
  active: boolean;
  write_date: string;
}

interface OdooEmployee {
  id: number;
  name: string;
  work_email: string | false;
  mobile_phone: string | false;
  work_phone: string | false;
  job_title: string | false;
  department_id: [number, string] | false;
  gender: "male" | "female" | "other" | false;
  date_of_birth: string | false;
  employee_number: string | false;
  active: boolean;
  write_date: string;
}

// ---------------------------------------------------------------------------
// OdooConnector
// ---------------------------------------------------------------------------

export class OdooConnector extends BaseConnector {
  readonly type = "ODOO";
  private readonly odooConfig: OdooConfig;
  private readonly validation = new ValidationEngine();
  private uid: number | null = null;

  constructor(organizationId: string, config: OdooConfig) {
    super(organizationId, config as unknown as Record<string, unknown>);
    this.odooConfig = config;
  }

  // Lazily authenticate and cache uid within the connector instance
  private async getUid(): Promise<number> {
    if (this.uid !== null) return this.uid;

    this.uid = await odooAuthenticate(
      this.odooConfig.baseUrl,
      this.odooConfig.database,
      this.odooConfig.username,
      this.odooConfig.password
    );

    return this.uid;
  }

  // Shorthand helpers
  private get url() { return this.odooConfig.baseUrl; }
  private get db() { return this.odooConfig.database; }
  private get pw() { return this.odooConfig.password; }

  // ---------------------------------------------------------------------------
  // Test connection
  // ---------------------------------------------------------------------------
  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const uid = await this.getUid();

      // Fetch server version info
      const info = await odooRpc<Record<string, unknown>>(
        this.url,
        "common",
        "version",
        []
      );

      const latencyMs = Date.now() - start;
      return {
        success: true,
        latencyMs,
        details: `Connected as uid=${uid}. Odoo ${info["server_version"] ?? "Unknown"}`,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch customers (res.partner where customer_rank > 0)
  // ---------------------------------------------------------------------------
  async fetchCustomers(cursor?: SyncCursor): Promise<ExtractionResult<RawCustomer>> {
    const uid = await this.getUid();

    const domain: OdooDomain = [["customer_rank", ">", 0]];
    if (cursor?.lastModifiedAt) {
      domain.push(["write_date", ">=", cursor.lastModifiedAt]);
    }

    const partners = await odooFetchAll<OdooPartner>(
      this.url, this.db, uid, this.pw,
      {
        model: "res.partner",
        domain,
        fields: [
          "id", "name", "email", "phone", "mobile", "street", "street2",
          "city", "state_id", "country_id", "vat", "company_type",
          "company_name", "customer_rank", "write_date",
        ],
        order: "write_date asc",
      }
    );

    const records = partners.map((p) => this.transformPartner(p));
    const lastModified = partners[partners.length - 1]?.write_date;

    return {
      records,
      totalCount: records.length,
      hasMore: false,
      nextCursor: lastModified,
      sourceInfo: { connectorType: this.type, extractedAt: new Date() },
    };
  }

  // ---------------------------------------------------------------------------
  // Fetch invoices (account.move, type=out_invoice)
  // ---------------------------------------------------------------------------
  async fetchInvoices(cursor?: SyncCursor): Promise<ExtractionResult<RawInvoice>> {
    const uid = await this.getUid();

    const domain: OdooDomain = [
      ["move_type", "=", "out_invoice"],
      ["state", "!=", "cancel"],
    ];
    if (cursor?.lastModifiedAt) {
      domain.push(["write_date", ">=", cursor.lastModifiedAt]);
    }

    const moves = await odooFetchAll<OdooAccountMove>(
      this.url, this.db, uid, this.pw,
      {
        model: "account.move",
        domain,
        fields: [
          "id", "name", "partner_id", "invoice_date", "invoice_date_due",
          "state", "payment_state", "amount_untaxed", "amount_tax",
          "amount_total", "amount_residual", "currency_id", "narration",
          "write_date", "move_type", "invoice_line_ids",
        ],
        order: "write_date asc",
      }
    );

    // Batch-fetch line items for all invoices in one call
    const allLineIds = moves.flatMap((m) => m.invoice_line_ids);
    const lineMap = await this.fetchInvoiceLines(uid, allLineIds);

    const records = moves.map((m) => this.transformInvoice(m, lineMap));
    const lastModified = moves[moves.length - 1]?.write_date;

    return {
      records,
      totalCount: records.length,
      hasMore: false,
      nextCursor: lastModified,
      sourceInfo: { connectorType: this.type, extractedAt: new Date() },
    };
  }

  private async fetchInvoiceLines(
    uid: number,
    lineIds: number[]
  ): Promise<Map<number, OdooAccountMoveLine>> {
    if (lineIds.length === 0) return new Map();

    const lines = await odooSearchRead<OdooAccountMoveLine>(
      this.url, this.db, uid, this.pw,
      {
        model: "account.move.line",
        domain: [["id", "in", lineIds], ["exclude_from_invoice_tab", "=", false]],
        fields: ["id", "name", "quantity", "price_unit", "tax_ids", "price_subtotal"],
        limit: 2000,
      }
    );

    return new Map(lines.map((l) => [l.id, l]));
  }

  // ---------------------------------------------------------------------------
  // Fetch products (product.template)
  // ---------------------------------------------------------------------------
  async fetchProducts(cursor?: SyncCursor): Promise<ExtractionResult<RawProduct>> {
    const uid = await this.getUid();

    const domain: OdooDomain = [["sale_ok", "=", true], ["active", "=", true]];
    if (cursor?.lastModifiedAt) {
      domain.push(["write_date", ">=", cursor.lastModifiedAt]);
    }

    const products = await odooFetchAll<OdooProductTemplate>(
      this.url, this.db, uid, this.pw,
      {
        model: "product.template",
        domain,
        fields: [
          "id", "name", "default_code", "description", "categ_id",
          "uom_id", "standard_price", "list_price", "taxes_id",
          "qty_available", "active", "write_date",
        ],
        order: "write_date asc",
      }
    );

    const records = products.map((p) => this.transformProduct(p));
    const lastModified = products[products.length - 1]?.write_date;

    return {
      records,
      totalCount: records.length,
      hasMore: false,
      nextCursor: lastModified,
      sourceInfo: { connectorType: this.type, extractedAt: new Date() },
    };
  }

  // ---------------------------------------------------------------------------
  // Fetch employees (hr.employee)
  // ---------------------------------------------------------------------------
  async fetchEmployees(cursor?: SyncCursor): Promise<ExtractionResult<RawEmployee>> {
    const uid = await this.getUid();

    try {
      const domain: OdooDomain = [["active", "=", true]];
      if (cursor?.lastModifiedAt) {
        domain.push(["write_date", ">=", cursor.lastModifiedAt]);
      }

      const employees = await odooFetchAll<OdooEmployee>(
        this.url, this.db, uid, this.pw,
        {
          model: "hr.employee",
          domain,
          fields: [
            "id", "name", "work_email", "mobile_phone", "work_phone",
            "job_title", "department_id", "gender", "date_of_birth",
            "employee_number", "active", "write_date",
          ],
          order: "write_date asc",
        }
      );

      const records = employees.map((e) => this.transformEmployee(e));
      const lastModified = employees[employees.length - 1]?.write_date;

      return {
        records,
        totalCount: records.length,
        hasMore: false,
        nextCursor: lastModified,
        sourceInfo: { connectorType: this.type, extractedAt: new Date() },
      };
    } catch {
      // HR module may not be installed
      return {
        records: [],
        totalCount: 0,
        hasMore: false,
        sourceInfo: { connectorType: this.type, extractedAt: new Date() },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Validate
  // ---------------------------------------------------------------------------
  validate(data: Record<string, unknown>, entity: string): ValidationResult {
    return this.validation.validate(
      data,
      entity as "customer" | "invoice" | "product"
    );
  }

  // ---------------------------------------------------------------------------
  // Full sync
  // ---------------------------------------------------------------------------
  async sync(entity: string, cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };

    if (entity === "customers" || entity === "all") {
      mergeStats(stats, await this.syncCustomers(cursor));
    }
    if (entity === "invoices" || entity === "all") {
      mergeStats(stats, await this.syncInvoices(cursor));
    }
    if (entity === "products" || entity === "all") {
      mergeStats(stats, await this.syncProducts(cursor));
    }

    return stats;
  }

  // ---------------------------------------------------------------------------
  // Transformers: Odoo → Raw types
  // ---------------------------------------------------------------------------
  private transformPartner(p: OdooPartner): RawCustomer {
    const addressParts = [
      p.street !== false ? p.street : null,
      p.street2 !== false ? p.street2 : null,
    ].filter(Boolean);

    return {
      externalId: String(p.id),
      name: p.name,
      email: p.email !== false ? p.email : undefined,
      phone: p.mobile !== false ? p.mobile : p.phone !== false ? p.phone : undefined,
      company: p.company_type === "person"
        ? (p.company_name !== false ? p.company_name : undefined)
        : p.name,
      address: addressParts.join(", ") || undefined,
      city: p.city !== false ? p.city : undefined,
      state: p.state_id !== false ? p.state_id[1] : undefined,
      country: p.country_id !== false ? p.country_id[1] : undefined,
      gstin: p.vat !== false ? p.vat : undefined,
    };
  }

  private transformInvoice(
    m: OdooAccountMove,
    lineMap: Map<number, OdooAccountMoveLine>
  ): RawInvoice {
    const lineItems = m.invoice_line_ids
      .map((id) => lineMap.get(id))
      .filter((l): l is OdooAccountMoveLine => !!l)
      .map((l) => ({
        description: l.name,
        quantity: l.quantity,
        unitPrice: l.price_unit,
        taxPercent: 0,
        amount: l.price_subtotal,
      }));

    return {
      externalId: String(m.id),
      invoiceNumber: m.name,
      customerExternalId: m.partner_id !== false ? String(m.partner_id[0]) : undefined,
      customerName: m.partner_id !== false ? m.partner_id[1] : undefined,
      issueDate: m.invoice_date !== false ? m.invoice_date : new Date().toISOString().split("T")[0],
      dueDate: m.invoice_date_due !== false ? m.invoice_date_due : m.invoice_date !== false ? m.invoice_date : "",
      status: mapOdooStatus(m.state, m.payment_state),
      subtotal: m.amount_untaxed,
      taxAmount: m.amount_tax,
      total: m.amount_total,
      currency: m.currency_id[1],
      notes: m.narration !== false ? m.narration : undefined,
      lineItems,
    };
  }

  private transformProduct(p: OdooProductTemplate): RawProduct {
    return {
      externalId: String(p.id),
      sku: p.default_code !== false ? p.default_code : undefined,
      name: p.name,
      description: p.description !== false ? p.description : undefined,
      category: p.categ_id !== false ? p.categ_id[1] : undefined,
      unit: p.uom_id !== false ? p.uom_id[1] : undefined,
      costPrice: p.standard_price,
      sellingPrice: p.list_price,
      taxRate: 0,
      stock: p.qty_available,
    };
  }

  private transformEmployee(e: OdooEmployee): RawEmployee {
    return {
      externalId: e.employee_number !== false ? e.employee_number : String(e.id),
      name: e.name,
      email: e.work_email !== false ? e.work_email : undefined,
      phone: e.mobile_phone !== false ? e.mobile_phone : e.work_phone !== false ? e.work_phone : undefined,
      designation: e.job_title !== false ? e.job_title : undefined,
      department: e.department_id !== false ? e.department_id[1] : undefined,
      gender: e.gender !== false ? (e.gender.toUpperCase() as "MALE" | "FEMALE" | "OTHER") : undefined,
      dateOfBirth: e.date_of_birth !== false ? e.date_of_birth : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // DB Sync Methods
  // ---------------------------------------------------------------------------
  private async syncCustomers(cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };
    const extraction = await this.fetchCustomers(cursor);

    for (const raw of extraction.records) {
      try {
        const existing = await prisma.customer.findFirst({
          where: {
            organizationId: this.organizationId,
            OR: [
              ...(raw.email ? [{ email: raw.email }] : []),
              { name: raw.name },
            ],
          },
        });

        if (existing) {
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              name: raw.name,
              email: raw.email ?? null,
              phone: raw.phone ?? null,
              company: raw.company ?? null,
              address: raw.address ?? null,
              city: raw.city ?? null,
              state: raw.state ?? null,
              country: raw.country ?? null,
              gstin: raw.gstin ?? null,
            },
          });
          stats.updated++;
        } else {
          await prisma.customer.create({
            data: {
              organizationId: this.organizationId,
              name: raw.name,
              email: raw.email ?? null,
              phone: raw.phone ?? null,
              company: raw.company ?? null,
              address: raw.address ?? null,
              city: raw.city ?? null,
              state: raw.state ?? null,
              country: raw.country ?? null,
              gstin: raw.gstin ?? null,
              customerType: raw.company ? "BUSINESS" : "INDIVIDUAL",
              isActive: true,
            },
          });
          stats.created++;
        }
      } catch (err) {
        this.log("error", `Failed to sync Odoo partner ${raw.name}`, err);
        stats.failed++;
      }
    }

    stats.nextCursor = extraction.nextCursor;
    return stats;
  }

  private async syncInvoices(cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };
    const extraction = await this.fetchInvoices(cursor);

    for (const raw of extraction.records) {
      try {
        const customer = await prisma.customer.findFirst({
          where: { organizationId: this.organizationId, name: raw.customerName ?? "" },
        });

        if (!customer) {
          stats.skipped++;
          continue;
        }

        const existing = await prisma.invoice.findFirst({
          where: { organizationId: this.organizationId, invoiceNumber: raw.invoiceNumber },
        });

        const data = {
          customerId: customer.id,
          organizationId: this.organizationId,
          invoiceNumber: raw.invoiceNumber,
          status: raw.status as "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "PARTIAL" | "VIEWED",
          issueDate: new Date(raw.issueDate),
          dueDate: new Date(raw.dueDate || raw.issueDate),
          subtotal: Number(raw.subtotal),
          taxAmount: Number(raw.taxAmount),
          total: Number(raw.total),
          balanceDue: Number(raw.total),
          currency: raw.currency ?? "INR",
          notes: raw.notes ?? null,
          taxRate: 0,
        };

        if (existing) {
          await prisma.invoice.update({ where: { id: existing.id }, data });
          stats.updated++;
        } else {
          await prisma.invoice.create({ data });
          stats.created++;
        }
      } catch (err) {
        this.log("error", `Failed to sync Odoo invoice ${raw.invoiceNumber}`, err);
        stats.failed++;
      }
    }

    stats.nextCursor = extraction.nextCursor;
    return stats;
  }

  private async syncProducts(cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };
    const extraction = await this.fetchProducts(cursor);

    for (const raw of extraction.records) {
      try {
        const existing = raw.sku
          ? await prisma.item.findFirst({
              where: { organizationId: this.organizationId, sku: raw.sku },
            })
          : await prisma.item.findFirst({
              where: { organizationId: this.organizationId, name: raw.name },
            });

        const data = {
          organizationId: this.organizationId,
          name: raw.name,
          sku: raw.sku ?? null,
          description: raw.description ?? null,
          category: raw.category ?? null,
          unit: raw.unit ?? null,
          costPrice: Number(raw.costPrice ?? 0),
          sellingPrice: Number(raw.sellingPrice ?? 0),
          taxRate: Number(raw.taxRate ?? 0),
          stock: Number(raw.stock ?? 0),
          isActive: true,
        };

        if (existing) {
          await prisma.item.update({ where: { id: existing.id }, data });
          stats.updated++;
        } else {
          await prisma.item.create({ data });
          stats.created++;
        }
      } catch (err) {
        this.log("error", `Failed to sync Odoo product ${raw.name}`, err);
        stats.failed++;
      }
    }

    stats.nextCursor = extraction.nextCursor;
    return stats;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapOdooStatus(
  state: OdooAccountMove["state"],
  paymentState: OdooAccountMove["payment_state"]
): string {
  if (state === "cancel") return "CANCELLED";
  if (state === "draft") return "DRAFT";
  if (paymentState === "paid") return "PAID";
  if (paymentState === "partial") return "PARTIAL";
  if (paymentState === "in_payment") return "PAID";
  return "SENT";
}

function mergeStats(target: SyncStats, source: SyncStats): void {
  target.created += source.created;
  target.updated += source.updated;
  target.skipped += source.skipped;
  target.failed += source.failed;
  target.merged += source.merged;
  if (source.nextCursor) target.nextCursor = source.nextCursor;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
