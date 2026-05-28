// ============================================================
// FinRP — Tally Prime Connector
// Communicates with Tally Prime via HTTP XML on port 9000.
// Uses TDL (Tally Definition Language) XML requests to extract
// ledgers, vouchers, stock items, and employees.
// Supports both direct Tally (LAN) and Tally Bridge (cloud proxy).
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
  TallyConfig,
} from "../base/types";
import { ValidationEngine } from "@/lib/validation/engine";
import { prisma } from "@/lib/prisma";
import { XMLParser } from "fast-xml-parser";

// ---------------------------------------------------------------------------
// Tally XML Envelopes (TDL)
// ---------------------------------------------------------------------------

function buildEnvelope(requestNode: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      ${requestNode}
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`.trim();
}

// Fetch all ledgers (customers/vendors)
function ledgerRequestXml(companyName?: string): string {
  const companyFilter = companyName
    ? `<STATICVARIABLES><SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY></STATICVARIABLES>`
    : "";

  return buildEnvelope(`
    <REQUESTDESC>
      <REPORTNAME>List of Ledger</REPORTNAME>
      ${companyFilter}
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </REQUESTDESC>
  `);
}

// Fetch vouchers (invoices/payments) with optional date range
function voucherRequestXml(
  fromDate: string,
  toDate: string,
  voucherType = "Sales",
  companyName?: string
): string {
  const companyFilter = companyName
    ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>`
    : "";

  return buildEnvelope(`
    <REQUESTDESC>
      <REPORTNAME>Voucher Register</REPORTNAME>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE>${fromDate}</SVFROMDATE>
        <SVTODATE>${toDate}</SVTODATE>
        <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
        ${companyFilter}
      </STATICVARIABLES>
    </REQUESTDESC>
  `);
}

// Fetch stock items (inventory)
function stockItemRequestXml(companyName?: string): string {
  const companyFilter = companyName
    ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>`
    : "";

  return buildEnvelope(`
    <REQUESTDESC>
      <REPORTNAME>List of Stock Items</REPORTNAME>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        ${companyFilter}
      </STATICVARIABLES>
    </REQUESTDESC>
  `);
}

// Fetch employees
function employeeRequestXml(companyName?: string): string {
  const companyFilter = companyName
    ? `<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>`
    : "";

  return buildEnvelope(`
    <REQUESTDESC>
      <REPORTNAME>Employee List</REPORTNAME>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        ${companyFilter}
      </STATICVARIABLES>
    </REQUESTDESC>
  `);
}

// ---------------------------------------------------------------------------
// HTTP Transport
// ---------------------------------------------------------------------------

async function tallyPost(
  url: string,
  xml: string,
  timeoutMs = 30_000
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: xml,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Tally HTTP error ${res.status}: ${res.statusText}`);
    }

    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// XML Parsing Helpers
// ---------------------------------------------------------------------------

function parseXml(xml: string): Record<string, unknown> {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      parseAttributeValue: false,
      isArray: () => false, // match xml2js explicitArray:false behaviour
    });
    return parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse Tally XML response");
  }
}

function safeText(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "object" && "_" in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)["_"]).trim();
  }
  return String(val).trim();
}

function ensureArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function formatTallyDate(tallyDate: string): string {
  // Tally dates: YYYYMMDD → YYYY-MM-DD
  if (!tallyDate || tallyDate.length !== 8) return "";
  return `${tallyDate.slice(0, 4)}-${tallyDate.slice(4, 6)}-${tallyDate.slice(6, 8)}`;
}

// ---------------------------------------------------------------------------
// Raw Tally type shapes
// ---------------------------------------------------------------------------

interface TallyLedger {
  NAME?: unknown;
  PARENT?: unknown;
  MAILINGNAME?: unknown;
  EMAIL?: unknown;
  LEDGERPHONE?: unknown;
  LEDGERMOBILE?: unknown;
  ADDRESS?: unknown;
  PINCODE?: unknown;
  COUNTRY?: unknown;
  GSTREGISTRATIONTYPE?: unknown;
  PARTYGSTIN?: unknown;
  OPENINGBALANCE?: unknown;
  CLOSINGBALANCE?: unknown;
}

interface TallyVoucher {
  GUID?: unknown;
  VOUCHERNUMBER?: unknown;
  VOUCHERTYPENAME?: unknown;
  DATE?: unknown;
  EFFECTIVEDATE?: unknown;
  PARTYLEDGERNAME?: unknown;
  BASICBUYERNAME?: unknown;
  NARRATION?: unknown;
  AMOUNT?: unknown;
  LEDGERENTRIES?: {
    LEDGERENTRY?: unknown;
  };
  INVENTORYENTRIES?: {
    INVENTORYENTRY?: unknown;
  };
}

interface TallyStockItem {
  NAME?: unknown;
  PARENT?: unknown;
  DESCRIPTION?: unknown;
  BASEUNITS?: unknown;
  OPENINGRATE?: unknown;
  OPENINGBALANCE?: unknown;
  CLOSINGRATE?: unknown;
  CLOSINGBALANCE?: unknown;
  GSTDETAILS?: unknown;
}

interface TallyEmployee {
  NAME?: unknown;
  PARENT?: unknown;
  EMPLOYEEID?: unknown;
  EMAIL?: unknown;
  PHONENUMBER?: unknown;
  DESIGNATION?: unknown;
  DEPARTMENT?: unknown;
  GENDER?: unknown;
  DATEDOFJOINING?: unknown;
}

// ---------------------------------------------------------------------------
// Tally Connector
// ---------------------------------------------------------------------------

export class TallyConnector extends BaseConnector {
  readonly type = "TALLY";
  private readonly tallyConfig: TallyConfig;
  private readonly validation = new ValidationEngine();
  private readonly baseUrl: string;

  constructor(organizationId: string, config: TallyConfig) {
    super(organizationId, config as unknown as Record<string, unknown>);
    this.tallyConfig = config;
    // Support Tally Bridge (https proxy) or direct Tally (http://localhost:9000)
    this.baseUrl = config.bridgeUrl ?? `http://${config.host ?? "localhost"}:${config.port ?? 9000}`;
  }

  // ---------------------------------------------------------------------------
  // Test connection by fetching company list
  // ---------------------------------------------------------------------------
  async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const companyListXml = buildEnvelope(`
        <REQUESTDESC>
          <REPORTNAME>List of Companies</REPORTNAME>
          <STATICVARIABLES>
            <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          </STATICVARIABLES>
        </REQUESTDESC>
      `);

      const responseXml = await tallyPost(this.baseUrl, companyListXml, 10_000);
      const parsed = parseXml(responseXml);
      const envelope = parsed["ENVELOPE"] as Record<string, unknown> | undefined;

      const latencyMs = Date.now() - start;

      if (!envelope) {
        return { success: false, latencyMs, error: "Invalid Tally response: no ENVELOPE" };
      }

      // Try to extract company name for display
      let companyName = "Unknown";
      try {
        const body = envelope["BODY"] as Record<string, unknown> | undefined;
        const exportData = body?.["EXPORTDATA"] as Record<string, unknown> | undefined;
        const reqProcessed = exportData?.["REQUESTPROCESSED"] as Record<string, unknown> | undefined;
        const companyInfo = reqProcessed?.["REQUESTDATA"] as Record<string, unknown> | undefined;
        const collection = companyInfo?.["TALLYMESSAGE"] as Record<string, unknown> | undefined;
        const company = collection?.["COMPANY"] as Record<string, unknown> | undefined;
        if (company) {
          companyName = safeText(company["NAME"]);
        }
      } catch {
        // Best-effort parsing
      }

      return {
        success: true,
        latencyMs,
        details: `Connected to Tally. Active company: ${companyName}`,
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
  // Fetch customers (from Sales/Sundry Debtors ledgers)
  // ---------------------------------------------------------------------------
  async fetchCustomers(cursor?: SyncCursor): Promise<ExtractionResult<RawCustomer>> {
    const xml = ledgerRequestXml(this.tallyConfig.companyName);
    const responseXml = await tallyPost(this.baseUrl, xml);
    const parsed = parseXml(responseXml);

    const ledgers = this.extractLedgers(parsed);
    const debtors = ledgers.filter((l) => {
      const parent = safeText(l.PARENT).toLowerCase();
      return (
        parent.includes("sundry debtor") ||
        parent.includes("debtor") ||
        parent.includes("customer") ||
        parent.includes("receivable")
      );
    });

    const records = debtors.map((l) => this.transformLedger(l));

    return {
      records,
      totalCount: records.length,
      hasMore: false,
      nextCursor: undefined,
      sourceInfo: {
        connectorType: this.type,
        extractedAt: new Date(),
        queryParams: { company: this.tallyConfig.companyName ?? "default" },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Fetch invoices (Sales vouchers)
  // ---------------------------------------------------------------------------
  async fetchInvoices(cursor?: SyncCursor): Promise<ExtractionResult<RawInvoice>> {
    const toDate = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const fromDateObj = cursor?.lastModifiedAt
      ? new Date(cursor.lastModifiedAt)
      : new Date(new Date().getFullYear(), 3, 1); // Start of Indian FY (April 1)
    const fromDate = fromDateObj.toISOString().split("T")[0].replace(/-/g, "");

    const salesXml = voucherRequestXml(
      fromDate,
      toDate,
      "Sales",
      this.tallyConfig.companyName
    );

    const responseXml = await tallyPost(this.baseUrl, salesXml);
    const parsed = parseXml(responseXml);
    const vouchers = this.extractVouchers(parsed);

    const records = vouchers.map((v) => this.transformVoucher(v));

    return {
      records,
      totalCount: records.length,
      hasMore: false,
      nextCursor: toDate,
      sourceInfo: { connectorType: this.type, extractedAt: new Date() },
    };
  }

  // ---------------------------------------------------------------------------
  // Fetch products (stock items)
  // ---------------------------------------------------------------------------
  async fetchProducts(cursor?: SyncCursor): Promise<ExtractionResult<RawProduct>> {
    const xml = stockItemRequestXml(this.tallyConfig.companyName);
    const responseXml = await tallyPost(this.baseUrl, xml);
    const parsed = parseXml(responseXml);
    const items = this.extractStockItems(parsed);

    const records = items.map((item) => this.transformStockItem(item));

    return {
      records,
      totalCount: records.length,
      hasMore: false,
      nextCursor: undefined,
      sourceInfo: { connectorType: this.type, extractedAt: new Date() },
    };
  }

  // ---------------------------------------------------------------------------
  // Fetch employees (Payroll module)
  // ---------------------------------------------------------------------------
  async fetchEmployees(cursor?: SyncCursor): Promise<ExtractionResult<RawEmployee>> {
    try {
      const xml = employeeRequestXml(this.tallyConfig.companyName);
      const responseXml = await tallyPost(this.baseUrl, xml, 15_000);
      const parsed = parseXml(responseXml);
      const employees = this.extractEmployees(parsed);
      const records = employees.map((e) => this.transformEmployee(e));

      return {
        records,
        totalCount: records.length,
        hasMore: false,
        nextCursor: undefined,
        sourceInfo: { connectorType: this.type, extractedAt: new Date() },
      };
    } catch {
      // Payroll may not be enabled — return empty gracefully
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
  // Full sync — used by sync worker
  // ---------------------------------------------------------------------------
  async sync(entity: string, cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = {
      created: 0, updated: 0, skipped: 0, failed: 0, merged: 0,
    };

    if (entity === "customers" || entity === "all") {
      const s = await this.syncCustomers(cursor);
      mergeStats(stats, s);
    }
    if (entity === "invoices" || entity === "all") {
      const s = await this.syncInvoices(cursor);
      mergeStats(stats, s);
    }
    if (entity === "products" || entity === "all") {
      const s = await this.syncProducts(cursor);
      mergeStats(stats, s);
    }

    return stats;
  }

  // ---------------------------------------------------------------------------
  // XML extraction helpers
  // ---------------------------------------------------------------------------
  private extractLedgers(parsed: Record<string, unknown>): TallyLedger[] {
    try {
      const envelope = parsed["ENVELOPE"] as Record<string, unknown>;
      const body = envelope?.["BODY"] as Record<string, unknown>;
      const exportData = body?.["EXPORTDATA"] as Record<string, unknown>;
      const reqProcessed = exportData?.["REQUESTPROCESSED"] as Record<string, unknown>;
      const reqData = reqProcessed?.["REQUESTDATA"] as Record<string, unknown>;
      const messages = reqData?.["TALLYMESSAGE"] as Record<string, unknown> | Array<Record<string, unknown>>;

      const msgArray = ensureArray(messages as TallyLedger);
      return msgArray
        .map((m) => (m as Record<string, unknown>)["LEDGER"] as TallyLedger)
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private extractVouchers(parsed: Record<string, unknown>): TallyVoucher[] {
    try {
      const envelope = parsed["ENVELOPE"] as Record<string, unknown>;
      const body = envelope?.["BODY"] as Record<string, unknown>;
      const exportData = body?.["EXPORTDATA"] as Record<string, unknown>;
      const reqProcessed = exportData?.["REQUESTPROCESSED"] as Record<string, unknown>;
      const reqData = reqProcessed?.["REQUESTDATA"] as Record<string, unknown>;
      const messages = reqData?.["TALLYMESSAGE"];

      const msgArray = ensureArray(messages as TallyVoucher);
      return msgArray
        .map((m) => (m as Record<string, unknown>)["VOUCHER"] as TallyVoucher)
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private extractStockItems(parsed: Record<string, unknown>): TallyStockItem[] {
    try {
      const envelope = parsed["ENVELOPE"] as Record<string, unknown>;
      const body = envelope?.["BODY"] as Record<string, unknown>;
      const exportData = body?.["EXPORTDATA"] as Record<string, unknown>;
      const reqProcessed = exportData?.["REQUESTPROCESSED"] as Record<string, unknown>;
      const reqData = reqProcessed?.["REQUESTDATA"] as Record<string, unknown>;
      const messages = reqData?.["TALLYMESSAGE"];

      const msgArray = ensureArray(messages as TallyStockItem);
      return msgArray
        .map((m) => (m as Record<string, unknown>)["STOCKITEM"] as TallyStockItem)
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private extractEmployees(parsed: Record<string, unknown>): TallyEmployee[] {
    try {
      const envelope = parsed["ENVELOPE"] as Record<string, unknown>;
      const body = envelope?.["BODY"] as Record<string, unknown>;
      const exportData = body?.["EXPORTDATA"] as Record<string, unknown>;
      const reqProcessed = exportData?.["REQUESTPROCESSED"] as Record<string, unknown>;
      const reqData = reqProcessed?.["REQUESTDATA"] as Record<string, unknown>;
      const messages = reqData?.["TALLYMESSAGE"];

      const msgArray = ensureArray(messages as TallyEmployee);
      return msgArray
        .map((m) => (m as Record<string, unknown>)["EMPLOYEE"] as TallyEmployee)
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Transformers: Tally → Raw types
  // ---------------------------------------------------------------------------
  private transformLedger(l: TallyLedger): RawCustomer {
    const addressLines = ensureArray(l.ADDRESS as string | string[]);
    return {
      externalId: safeText(l.NAME),
      name: safeText(l.MAILINGNAME) || safeText(l.NAME),
      email: safeText(l.EMAIL) || undefined,
      phone: safeText(l.LEDGERMOBILE) || safeText(l.LEDGERPHONE) || undefined,
      address: addressLines.filter(Boolean).join(", ") || undefined,
      country: safeText(l.COUNTRY) || undefined,
      gstin: safeText(l.PARTYGSTIN) || undefined,
    };
  }

  private transformVoucher(v: TallyVoucher): RawInvoice {
    const dateStr = safeText(v.DATE);
    const effectiveDateStr = safeText(v.EFFECTIVEDATE) || dateStr;

    // Parse amount from ledger entries
    let total = 0;
    const ledgerEntries = ensureArray(
      (v.LEDGERENTRIES as Record<string, unknown>)?.["LEDGERENTRY"] as Record<string, unknown>
    );
    for (const entry of ledgerEntries) {
      const amt = parseFloat(safeText((entry as Record<string, unknown>)["AMOUNT"])) || 0;
      if (amt > 0) total = amt;
    }

    return {
      externalId: safeText(v.GUID) || safeText(v.VOUCHERNUMBER),
      invoiceNumber: safeText(v.VOUCHERNUMBER),
      customerName: safeText(v.PARTYLEDGERNAME) || safeText(v.BASICBUYERNAME),
      issueDate: formatTallyDate(dateStr),
      dueDate: formatTallyDate(effectiveDateStr),
      status: "SENT",
      subtotal: total,
      taxAmount: 0,
      total,
      currency: "INR",
      notes: safeText(v.NARRATION) || undefined,
      lineItems: this.extractLineItems(v),
    };
  }

  private extractLineItems(v: TallyVoucher) {
    const entries = ensureArray(
      (v.INVENTORYENTRIES as Record<string, unknown>)?.["INVENTORYENTRY"] as Record<string, unknown>
    );

    return entries.map((entry) => {
      const e = entry as Record<string, unknown>;
      return {
        description: safeText(e["STOCKITEMNAME"]),
        quantity: parseFloat(safeText(e["ACTUALQTY"])) || 0,
        unitPrice: parseFloat(safeText(e["RATE"])) || 0,
        taxPercent: 0,
        amount: parseFloat(safeText(e["AMOUNT"])) || 0,
      };
    });
  }

  private transformStockItem(item: TallyStockItem): RawProduct {
    return {
      externalId: safeText(item.NAME),
      name: safeText(item.NAME),
      description: safeText(item.DESCRIPTION) || undefined,
      category: safeText(item.PARENT) || undefined,
      unit: safeText(item.BASEUNITS) || undefined,
      sellingPrice: parseFloat(safeText(item.CLOSINGRATE)) || 0,
      costPrice: parseFloat(safeText(item.OPENINGRATE)) || 0,
      stock: parseFloat(safeText(item.CLOSINGBALANCE)) || 0,
    };
  }

  private transformEmployee(e: TallyEmployee): RawEmployee {
    return {
      externalId: safeText(e.EMPLOYEEID) || safeText(e.NAME),
      name: safeText(e.NAME),
      email: safeText(e.EMAIL) || undefined,
      phone: safeText(e.PHONENUMBER) || undefined,
      designation: safeText(e.DESIGNATION) || undefined,
      department: safeText(e.DEPARTMENT) || undefined,
      gender: safeText(e.GENDER) as "MALE" | "FEMALE" | "OTHER" | undefined || undefined,
      dateOfJoining: formatTallyDate(safeText(e.DATEDOFJOINING)) || undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // DB Sync Methods
  // ---------------------------------------------------------------------------
  private async syncCustomers(cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };
    const { records } = await this.fetchCustomers(cursor);

    for (const raw of records) {
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
              address: raw.address ?? null,
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
              address: raw.address ?? null,
              country: raw.country ?? null,
              gstin: raw.gstin ?? null,
              customerType: "INDIVIDUAL",
              isActive: true,
            },
          });
          stats.created++;
        }
      } catch (err) {
        this.log("error", `Failed to sync Tally customer ${raw.name}`, err);
        stats.failed++;
      }
    }

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
          status: "SENT" as const,
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
        this.log("error", `Failed to sync Tally voucher ${raw.invoiceNumber}`, err);
        stats.failed++;
      }
    }

    stats.nextCursor = extraction.nextCursor;
    return stats;
  }

  private async syncProducts(cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };
    const { records } = await this.fetchProducts(cursor);

    for (const raw of records) {
      try {
        const existing = await prisma.item.findFirst({
          where: { organizationId: this.organizationId, name: raw.name },
        });

        const data = {
          organizationId: this.organizationId,
          name: raw.name,
          description: raw.description ?? null,
          category: raw.category ?? null,
          unit: raw.unit ?? null,
          sellingPrice: Number(raw.sellingPrice ?? 0),
          costPrice: Number(raw.costPrice ?? 0),
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
        this.log("error", `Failed to sync Tally stock item ${raw.name}`, err);
        stats.failed++;
      }
    }

    return stats;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mergeStats(target: SyncStats, source: SyncStats): void {
  target.created += source.created;
  target.updated += source.updated;
  target.skipped += source.skipped;
  target.failed += source.failed;
  target.merged += source.merged;
  if (source.nextCursor) target.nextCursor = source.nextCursor;
}
