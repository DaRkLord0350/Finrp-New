// ============================================================
// FinRP — Zoho Connector (CRM + Books + Inventory)
// Extends BaseConnector. Transforms Zoho records to FinRP types.
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
  ZohoConfig,
} from "../base/types";
import {
  testZohoConnection,
  fetchAllCRMContacts,
  fetchBooksContacts,
  fetchBooksInvoices,
  fetchInventoryItems,
  type ZohoCRMContact,
  type ZohoBooksContact,
  type ZohoBooksInvoice,
  type ZohoInventoryItem,
} from "./api";
import { ValidationEngine } from "@/lib/validation/engine";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export class ZohoConnector extends BaseConnector {
  readonly type = "ZOHO";
  private readonly zohoConfig: ZohoConfig;
  private readonly integrationId: string;
  private readonly validation = new ValidationEngine();

  constructor(
    organizationId: string,
    integrationId: string,
    config: ZohoConfig
  ) {
    super(organizationId, config as unknown as Record<string, unknown>);
    this.zohoConfig = config;
    this.integrationId = integrationId;
  }

  // ---------------------------------------------------------------------------
  // Test connection
  // ---------------------------------------------------------------------------
  async testConnection(): Promise<ConnectionTestResult> {
    const result = await testZohoConnection({
      integrationId: this.integrationId,
      dataCenter: this.zohoConfig.dataCenter,
    });
    return {
      success: result.success,
      latencyMs: result.latencyMs,
      details: result.details,
      error: result.error,
    };
  }

  // ---------------------------------------------------------------------------
  // Extract: Customers from CRM Contacts
  // ---------------------------------------------------------------------------
  async fetchCustomers(cursor?: SyncCursor): Promise<ExtractionResult<RawCustomer>> {
    const contacts = await fetchAllCRMContacts({
      integrationId: this.integrationId,
      dataCenter: this.zohoConfig.dataCenter,
      modifiedAfter: cursor?.lastModifiedAt,
    });

    const records = contacts.map((c) => this.transformCRMContact(c));
    const lastModified = contacts[contacts.length - 1]?.Modified_Time;

    return {
      records,
      totalCount: records.length,
      nextCursor: lastModified,
      hasMore: false,
      sourceInfo: {
        connectorType: this.type,
        extractedAt: new Date(),
        queryParams: { modifiedAfter: cursor?.lastModifiedAt ?? "all" },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Extract: Invoices from Zoho Books
  // ---------------------------------------------------------------------------
  async fetchInvoices(cursor?: SyncCursor): Promise<ExtractionResult<RawInvoice>> {
    const accountId = this.zohoConfig.accountId ?? "";
    const all: ZohoBooksInvoice[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await fetchBooksInvoices({
        integrationId: this.integrationId,
        dataCenter: this.zohoConfig.dataCenter,
        accountId,
        page,
        modifiedAfter: cursor?.lastModifiedAt,
      });
      all.push(...result.invoices);
      hasMore = result.hasMore;
      page++;
      if (!hasMore) break;
    }

    const records = all.map((inv) => this.transformBooksInvoice(inv));
    const lastModified = all[all.length - 1]?.last_modified_time;

    return {
      records,
      totalCount: records.length,
      nextCursor: lastModified,
      hasMore: false,
      sourceInfo: { connectorType: this.type, extractedAt: new Date() },
    };
  }

  // ---------------------------------------------------------------------------
  // Extract: Products from Zoho Inventory
  // ---------------------------------------------------------------------------
  async fetchProducts(cursor?: SyncCursor): Promise<ExtractionResult<RawProduct>> {
    const accountId = this.zohoConfig.accountId ?? "";
    const all: ZohoInventoryItem[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await fetchInventoryItems({
        integrationId: this.integrationId,
        dataCenter: this.zohoConfig.dataCenter,
        accountId,
        page,
        modifiedAfter: cursor?.lastModifiedAt,
      });
      all.push(...result.items);
      hasMore = result.hasMore;
      page++;
      if (!hasMore) break;
    }

    const records = all.map((item) => this.transformInventoryItem(item));
    const lastModified = all[all.length - 1]?.last_modified_time;

    return {
      records,
      totalCount: records.length,
      nextCursor: lastModified,
      hasMore: false,
      sourceInfo: { connectorType: this.type, extractedAt: new Date() },
    };
  }

  // No native employee API in Zoho standard
  async fetchEmployees(): Promise<ExtractionResult<RawEmployee>> {
    return { records: [], totalCount: 0, hasMore: false, sourceInfo: { connectorType: this.type, extractedAt: new Date() } };
  }

  // ---------------------------------------------------------------------------
  // Validate
  // ---------------------------------------------------------------------------
  validate(data: Record<string, unknown>, entity: string): ValidationResult {
    return this.validation.validate(data, entity as "customer" | "invoice" | "product");
  }

  // ---------------------------------------------------------------------------
  // Full sync entry point — called by the sync worker
  // ---------------------------------------------------------------------------
  async sync(entity: string, cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };

    try {
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
    } catch (err) {
      this.log("error", "Sync failed", err);
      throw err;
    }

    return stats;
  }

  // ---------------------------------------------------------------------------
  // Sync: Customers → prisma.customer
  // ---------------------------------------------------------------------------
  private async syncCustomers(cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };
    const extraction = await this.fetchCustomers(cursor);

    for (const raw of extraction.records) {
      try {
        const validation = this.validate(raw as unknown as Record<string, unknown>, "customer");
        if (!validation.valid) {
          stats.failed++;
          continue;
        }

        const existing = await prisma.customer.findFirst({
          where: {
            organizationId: this.organizationId,
            OR: [
              { email: raw.email ?? undefined },
              // Match by external ID stored in notes or a future externalId field
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
              customerType: "INDIVIDUAL",
              isActive: true,
            },
          });
          stats.created++;
        }
      } catch (err) {
        this.log("error", `Failed to sync customer ${raw.externalId}`, err);
        stats.failed++;
      }
    }

    stats.nextCursor = extraction.nextCursor;
    return stats;
  }

  // ---------------------------------------------------------------------------
  // Sync: Invoices → prisma.invoice
  // ---------------------------------------------------------------------------
  private async syncInvoices(cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };
    const extraction = await this.fetchInvoices(cursor);

    for (const raw of extraction.records) {
      try {
        // Find customer by name (best-effort)
        const customer = await prisma.customer.findFirst({
          where: { organizationId: this.organizationId, name: raw.customerName ?? "" },
        });

        if (!customer) {
          this.log("warn", `Customer not found for invoice ${raw.invoiceNumber}, skipping`);
          stats.skipped++;
          continue;
        }

        const existing = await prisma.invoice.findFirst({
          where: {
            organizationId: this.organizationId,
            invoiceNumber: raw.invoiceNumber,
          },
        });

        const invoiceData = {
          customerId: customer.id,
          organizationId: this.organizationId,
          invoiceNumber: raw.invoiceNumber,
          status: mapInvoiceStatus(raw.status),
          issueDate: new Date(raw.issueDate),
          dueDate: new Date(raw.dueDate),
          subtotal: Number(raw.subtotal),
          taxAmount: Number(raw.taxAmount),
          total: Number(raw.total),
          balanceDue: Number(raw.total) - 0,
          currency: raw.currency ?? "INR",
          notes: raw.notes ?? null,
          taxRate: 0,
        };

        if (existing) {
          await prisma.invoice.update({ where: { id: existing.id }, data: invoiceData });
          stats.updated++;
        } else {
          await prisma.invoice.create({ data: invoiceData });
          stats.created++;
        }
      } catch (err) {
        this.log("error", `Failed to sync invoice ${raw.invoiceNumber}`, err);
        stats.failed++;
      }
    }

    stats.nextCursor = extraction.nextCursor;
    return stats;
  }

  // ---------------------------------------------------------------------------
  // Sync: Products → prisma.item
  // ---------------------------------------------------------------------------
  private async syncProducts(cursor?: SyncCursor): Promise<SyncStats> {
    const stats: SyncStats = { created: 0, updated: 0, skipped: 0, failed: 0, merged: 0 };
    const extraction = await this.fetchProducts(cursor);

    for (const raw of extraction.records) {
      try {
        const existing = raw.sku
          ? await prisma.item.findFirst({
              where: { organizationId: this.organizationId, sku: raw.sku },
            })
          : null;

        const itemData = {
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
          await prisma.item.update({ where: { id: existing.id }, data: itemData });
          stats.updated++;
        } else {
          await prisma.item.create({ data: itemData });
          stats.created++;
        }
      } catch (err) {
        this.log("error", `Failed to sync product ${raw.name}`, err);
        stats.failed++;
      }
    }

    stats.nextCursor = extraction.nextCursor;
    return stats;
  }

  // ---------------------------------------------------------------------------
  // Transformers: Zoho → Raw types
  // ---------------------------------------------------------------------------
  private transformCRMContact(c: ZohoCRMContact): RawCustomer {
    return {
      externalId: c.id,
      name: [c.First_Name, c.Last_Name].filter(Boolean).join(" "),
      email: c.Email,
      phone: c.Phone,
      company: c.Account_Name?.name,
      address: c.Mailing_Street,
      city: c.Mailing_City,
      state: c.Mailing_State,
      country: c.Mailing_Country,
      gstin: c.GSTIN,
    };
  }

  private transformBooksInvoice(inv: ZohoBooksInvoice): RawInvoice {
    return {
      externalId: inv.invoice_id,
      invoiceNumber: inv.invoice_number,
      customerExternalId: inv.customer_id,
      customerName: inv.customer_name,
      issueDate: inv.date,
      dueDate: inv.due_date,
      status: inv.status,
      subtotal: inv.sub_total,
      taxAmount: inv.tax_total,
      total: inv.total,
      currency: inv.currency_code,
      lineItems: (inv.line_items ?? []).map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.rate,
        taxPercent: li.tax_percentage,
        amount: li.item_total,
      })),
    };
  }

  private transformInventoryItem(item: ZohoInventoryItem): RawProduct {
    return {
      externalId: item.item_id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: item.category_name,
      unit: item.unit,
      costPrice: item.purchase_rate,
      sellingPrice: item.rate,
      taxRate: item.tax_percentage,
      stock: item.stock_on_hand,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mapInvoiceStatus(status: string): "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "PARTIAL" | "VIEWED" {
  const map: Record<string, "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "PARTIAL" | "VIEWED"> = {
    draft: "DRAFT",
    sent: "SENT",
    paid: "PAID",
    overdue: "OVERDUE",
    void: "CANCELLED",
    partially_paid: "PARTIAL",
  };
  return map[status.toLowerCase()] ?? "DRAFT";
}

function mergeStats(target: SyncStats, source: SyncStats): void {
  target.created += source.created;
  target.updated += source.updated;
  target.skipped += source.skipped;
  target.failed += source.failed;
  target.merged += source.merged;
  if (source.nextCursor) target.nextCursor = source.nextCursor;
}
