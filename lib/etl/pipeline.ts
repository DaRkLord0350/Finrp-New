// ============================================================
// FinRP — ETL Pipeline
// Orchestrates: Extract → Transform → Validate → Deduplicate
//              → Normalize → Stage → Commit
//
// Designed for resumability: each row is staged in ImportRow
// before being committed. Failed rows are marked and can be
// retried individually without re-processing the entire file.
// ============================================================

import type { ImportJob, ImportRow, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MappingEngine } from "@/lib/mapping/engine";
import { ValidationEngine } from "@/lib/validation/engine";
import type { MappingRule } from "@/lib/connectors/base/types";

// ---------------------------------------------------------------------------
// Pipeline configuration
// ---------------------------------------------------------------------------

export type PipelineEntity = "customer" | "invoice" | "product" | "employee" | "ca_user" | "firm" | "assignment" | "master_import";

export interface PipelineConfig {
  importJobId: string;
  organizationId: string;
  entity: PipelineEntity;
  rules: MappingRule[];
  /** Called on each chunk to report progress (0-100) */
  onProgress?: (progress: number, message?: string) => Promise<void> | void;
  /** Number of rows to stage per DB transaction */
  chunkSize?: number;
  /** Commit rows immediately after staging (vs separate commit pass) */
  commitInline?: boolean;
}

// ---------------------------------------------------------------------------
// Pipeline result
// ---------------------------------------------------------------------------

export interface PipelineResult {
  totalRows: number;
  staged: number;
  committed: number;
  failed: number;
  warnings: number;
  duplicates: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Row staging shape
// ---------------------------------------------------------------------------

interface StagedRow {
  rowIndex: number;
  rawData: Record<string, string>;
  mappedData: Record<string, unknown>;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
}

// ---------------------------------------------------------------------------
// ETL Pipeline
// ---------------------------------------------------------------------------

export class ETLPipeline {
  private mapper = new MappingEngine();
  private validator = new ValidationEngine();

  async run(
    rawRows: Record<string, string>[],
    config: PipelineConfig
  ): Promise<PipelineResult> {
    const startMs = Date.now();
    const chunkSize = config.chunkSize ?? 100;

    const result: PipelineResult = {
      totalRows: rawRows.length,
      staged: 0,
      committed: 0,
      failed: 0,
      warnings: 0,
      duplicates: 0,
      durationMs: 0,
    };

    if (rawRows.length === 0) {
      await this.markJobComplete(config.importJobId, result);
      return result;
    }

    await config.onProgress?.(1, "Starting ETL pipeline…");

    // ── Phase 1: Transform + Validate (entire batch, for cross-row dedup) ──
    await config.onProgress?.(5, "Applying field mapping…");
    const mapped = this.mapper.mapRows(rawRows, config.rules);

    await config.onProgress?.(20, "Validating records…");
    const validationResults = this.validator.validateBatch(
      mapped as Record<string, unknown>[],
      config.entity
    );

    // ── Phase 2: Assemble staged rows ──
    await config.onProgress?.(35, "Preparing staged rows…");
    const staged: StagedRow[] = rawRows.map((raw, i) => {
      const vr = validationResults[i];
      return {
        rowIndex: i,
        rawData: raw,
        mappedData: mapped[i],
        errors: vr.errors.map((e) => e.message),
        warnings: vr.warnings.map((w) => w.message),
        isDuplicate: vr.isDuplicate,
      };
    });

    // ── Phase 3: Stage to DB in chunks ──
    await config.onProgress?.(40, "Staging rows to database…");
    const chunks = chunkArray(staged, chunkSize);

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      await this.stageChunk(chunk, config);

      result.staged += chunk.length;
      result.failed += chunk.filter((r) => r.errors.length > 0).length;
      result.warnings += chunk.filter((r) => r.warnings.length > 0).length;
      result.duplicates += chunk.filter((r) => r.isDuplicate).length;

      const progress = 40 + Math.round((ci / chunks.length) * 40);
      await config.onProgress?.(progress, `Staged ${result.staged}/${rawRows.length} rows…`);
    }

    // ── Phase 4: Commit valid rows ──
    await config.onProgress?.(80, "Committing valid rows…");
    result.committed = await this.commitStagedRows(config);

    result.durationMs = Date.now() - startMs;
    await config.onProgress?.(100, "Pipeline complete");
    await this.markJobComplete(config.importJobId, result);

    return result;
  }

  // ---------------------------------------------------------------------------
  // Retry only failed rows for a given import job
  // ---------------------------------------------------------------------------
  async retryFailed(importJobId: string, organizationId: string): Promise<PipelineResult> {
    const job = await prisma.importJob.findUnique({
      where: { id: importJobId },
    });

    if (!job || job.organizationId !== organizationId) {
      throw new Error("Import job not found");
    }

    const failedRows = await prisma.importRow.findMany({
      where: {
        importJobId,
        status: { in: ["FAILED", "PENDING"] },
      },
      orderBy: { rowIndex: "asc" },
    });

    if (failedRows.length === 0) {
      return { totalRows: 0, staged: 0, committed: 0, failed: 0, warnings: 0, duplicates: 0, durationMs: 0 };
    }

    const startMs = Date.now();
    let committed = 0;

    for (const row of failedRows) {
      try {
        const success = await this.commitRow(
          row.mappedData as Record<string, unknown>,
          mapEntityToInternal(job.entity) as PipelineEntity,
          organizationId
        );

        await prisma.importRow.update({
          where: { id: row.id },
          data: { status: success ? "SUCCESS" : "FAILED", processedAt: new Date() },
        });

        if (success) committed++;
      } catch {
        await prisma.importRow.update({
          where: { id: row.id },
          data: { status: "FAILED", processedAt: new Date() },
        });
      }
    }

    return {
      totalRows: failedRows.length,
      staged: 0,
      committed,
      failed: failedRows.length - committed,
      warnings: 0,
      duplicates: 0,
      durationMs: Date.now() - startMs,
    };
  }

  // ---------------------------------------------------------------------------
  // Stage a chunk to ImportRow table
  // ---------------------------------------------------------------------------
  private async stageChunk(
    chunk: StagedRow[],
    config: PipelineConfig
  ): Promise<void> {
    const data: Prisma.ImportRowCreateManyInput[] = chunk.map((row) => ({
      importJobId: config.importJobId,
      rowIndex: row.rowIndex,
      rawData: row.rawData as Prisma.InputJsonValue,
      mappedData: row.mappedData as Prisma.InputJsonValue,
      warnings: row.warnings,
      error: row.errors.length > 0 ? row.errors.join("; ") : null,
      isDuplicate: row.isDuplicate,
      status: row.errors.length > 0 ? "FAILED" : row.isDuplicate ? "DUPLICATE" : "PENDING",
    }));

    await prisma.importRow.createMany({ data, skipDuplicates: true });
  }

  // ---------------------------------------------------------------------------
  // Commit all PENDING (valid, non-duplicate) rows for an import job
  // ---------------------------------------------------------------------------
  private async commitStagedRows(config: PipelineConfig): Promise<number> {
    const rows = await prisma.importRow.findMany({
      where: {
        importJobId: config.importJobId,
        status: "PENDING",
      },
      orderBy: { rowIndex: "asc" },
    });

    let committed = 0;

    for (const row of rows) {
      try {
        const success = await this.commitRow(
          row.mappedData as Record<string, unknown>,
          config.entity,
          config.organizationId
        );

        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            status: success ? "SUCCESS" : "FAILED",
            processedAt: new Date(),
          },
        });

        if (success) committed++;
      } catch (err) {
        await prisma.importRow.update({
          where: { id: row.id },
          data: { status: "FAILED", processedAt: new Date() },
        });
      }
    }

    return committed;
  }

  // ---------------------------------------------------------------------------
  // Commit a single row to the appropriate DB table
  // ---------------------------------------------------------------------------
  private async commitRow(
    data: Record<string, unknown>,
    entity: PipelineEntity,
    organizationId: string
  ): Promise<boolean> {
    switch (entity) {
      case "customer":
        return this.upsertCustomer(data, organizationId);
      case "invoice":
        return this.upsertInvoice(data, organizationId);
      case "product":
        return this.upsertProduct(data, organizationId);
      case "employee":
        return this.upsertEmployee(data, organizationId);
      case "ca_user":
        return this.upsertCAUserInvitation(data, organizationId);
      case "firm":
        return this.upsertFirm(data, organizationId);
      case "assignment":
        return this.upsertAssignment(data, organizationId);
      case "master_import":
        return this.processMasterImportRow(data, organizationId);
      default:
        return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Entity-specific upsert handlers
  // ---------------------------------------------------------------------------

  private async upsertCustomer(
    data: Record<string, unknown>,
    organizationId: string
  ): Promise<boolean> {
    const name = String(data["name"] ?? "").trim();
    if (!name) return false;

    const email = data["email"] ? String(data["email"]).trim() : null;

    const existing = await prisma.customer.findFirst({
      where: {
        organizationId,
        ...(email ? { email } : { name }),
      },
    });

    const payload = {
      name,
      email: email || null,
      phone: data["phone"] ? String(data["phone"]) : null,
      company: data["company"] ? String(data["company"]) : null,
      address: data["address"] ? String(data["address"]) : null,
      city: data["city"] ? String(data["city"]) : null,
      state: data["state"] ? String(data["state"]) : null,
      country: data["country"] ? String(data["country"]) : null,
      gstin: data["gstin"] ? String(data["gstin"]) : null,
      notes: data["notes"] ? String(data["notes"]) : null,
    };

    if (existing) {
      await prisma.customer.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.customer.create({
        data: {
          organizationId,
          ...payload,
          customerType: data["company"] ? "BUSINESS" : "INDIVIDUAL",
          isActive: true,
        },
      });
    }

    return true;
  }

  private async upsertInvoice(
    data: Record<string, unknown>,
    organizationId: string
  ): Promise<boolean> {
    const invoiceNumber = String(data["invoiceNumber"] ?? "").trim();
    if (!invoiceNumber) return false;

    const customerName = String(data["customerName"] ?? "").trim();

    // Find or create the customer
    let customer = customerName
      ? await prisma.customer.findFirst({
          where: { organizationId, name: customerName },
        })
      : null;

    if (!customer && customerName) {
      customer = await prisma.customer.create({
        data: {
          organizationId,
          name: customerName,
          customerType: "INDIVIDUAL",
          isActive: true,
        },
      });
    }

    if (!customer) return false;

    const issueDateStr = String(data["issueDate"] ?? "");
    const dueDateStr = String(data["dueDate"] ?? issueDateStr);

    const issueDate = new Date(issueDateStr);
    const dueDate = new Date(dueDateStr);

    if (isNaN(issueDate.getTime())) return false;

    const invoicePayload = {
      customerId: customer.id,
      organizationId,
      invoiceNumber,
      status: normalizeInvoiceStatus(String(data["status"] ?? "sent")),
      issueDate,
      dueDate: isNaN(dueDate.getTime()) ? issueDate : dueDate,
      subtotal: Number(data["subtotal"] ?? 0),
      taxAmount: Number(data["taxAmount"] ?? 0),
      total: Number(data["total"] ?? 0),
      balanceDue: Number(data["total"] ?? 0),
      currency: String(data["currency"] ?? "INR"),
      notes: data["notes"] ? String(data["notes"]) : null,
      taxRate: Number(data["taxRate"] ?? 0),
    };

    const existing = await prisma.invoice.findFirst({
      where: { organizationId, invoiceNumber },
    });

    if (existing) {
      await prisma.invoice.update({ where: { id: existing.id }, data: invoicePayload });
    } else {
      await prisma.invoice.create({ data: invoicePayload });
    }

    return true;
  }

  private async upsertProduct(
    data: Record<string, unknown>,
    organizationId: string
  ): Promise<boolean> {
    const name = String(data["name"] ?? "").trim();
    if (!name) return false;

    const sku = data["sku"] ? String(data["sku"]).trim() : null;

    const existing = sku
      ? await prisma.item.findFirst({ where: { organizationId, sku } })
      : await prisma.item.findFirst({ where: { organizationId, name } });

    const payload = {
      name,
      sku: sku || null,
      description: data["description"] ? String(data["description"]) : null,
      category: data["category"] ? String(data["category"]) : null,
      unit: data["unit"] ? String(data["unit"]) : null,
      costPrice: Number(data["costPrice"] ?? 0),
      sellingPrice: Number(data["sellingPrice"] ?? 0),
      taxRate: Number(data["taxRate"] ?? 0),
      stock: Number(data["stock"] ?? 0),
    };

    if (existing) {
      await prisma.item.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.item.create({
        data: { organizationId, ...payload, isActive: true },
      });
    }

    return true;
  }

  private async upsertEmployee(
    data: Record<string, unknown>,
    organizationId: string
  ): Promise<boolean> {
    const name = String(data["name"] ?? "").trim();
    if (!name) return false;

    const email = data["email"] ? String(data["email"]).trim() : null;

    const existing = email
      ? await prisma.employee.findFirst({ where: { organizationId, email } })
      : await prisma.employee.findFirst({ where: { organizationId, name } });

    const doj = data["dateOfJoining"] ? new Date(String(data["dateOfJoining"])) : null;

    const payload = {
      name,
      email: email || null,
      phone: data["phone"] ? String(data["phone"]) : null,
      designation: data["designation"] ? String(data["designation"]) : null,
      department: data["department"] ? String(data["department"]) : null,
      joiningDate: doj && !isNaN(doj.getTime()) ? doj : null,
    };

    if (existing) {
      await prisma.employee.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.employee.create({
        data: {
          organizationId,
          ...payload,
          baseSalary: data["baseSalary"] ? Number(data["baseSalary"]) : 0,
          isActive: true,
        },
      });
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // CA User invitation handler
  // Creates an Invitation record so the CA receives an email link.
  // If a User with this email already exists in the org, it's a no-op.
  // ---------------------------------------------------------------------------
  private async upsertCAUserInvitation(
    data: Record<string, unknown>,
    organizationId: string
  ): Promise<boolean> {
    const email = String(data["email"] ?? "").trim().toLowerCase();
    if (!email) return false;

    const existing = await prisma.user.findFirst({
      where: { email, organizationId },
      select: { id: true },
    });
    if (existing) return true; // Already in org — skip

    // Check if pending invitation already exists
    const pendingInvite = await prisma.invitation.findFirst({
      where: { email, organizationId, acceptedAt: null },
      select: { id: true },
    });
    if (pendingInvite) return true; // Already invited — skip

    // Create invitation (7-day expiry)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.invitation.create({
      data: {
        organizationId,
        email,
        role: "STAFF",
        expiresAt,
      },
    });

    return true;
  }

  // ---------------------------------------------------------------------------
  // Firm upsert handler
  // ---------------------------------------------------------------------------
  private async upsertFirm(
    data: Record<string, unknown>,
    organizationId: string
  ): Promise<boolean> {
    const name = String(data["name"] ?? "").trim();
    if (!name) return false;

    const registrationNumber = data["registrationNumber"]
      ? String(data["registrationNumber"]).trim()
      : null;

    const existing = registrationNumber
      ? await prisma.firm.findFirst({
          where: { registrationNumber, users: { some: { organizationId } } },
        })
      : await prisma.firm.findFirst({
          where: { name, users: { some: { organizationId } } },
        });

    const payload = {
      name,
      registrationNumber: registrationNumber ?? undefined,
      email: data["email"] ? String(data["email"]).trim() : null,
      phone: data["phone"] ? String(data["phone"]).trim() : null,
      address: data["address"] ? String(data["address"]).trim() : null,
      city: data["city"] ? String(data["city"]).trim() : null,
      state: data["state"] ? String(data["state"]).trim() : null,
      country: data["country"] ? String(data["country"]).trim() : null,
      website: data["website"] ? String(data["website"]).trim() : null,
    };

    if (existing) {
      await prisma.firm.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.firm.create({ data: { ...payload, isActive: true } });
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Assignment upsert handler
  // Maps Customer → CA User creating CustomerAssignment.
  // Requires both customer and CA to already exist in the org.
  // ---------------------------------------------------------------------------
  private async upsertAssignment(
    data: Record<string, unknown>,
    organizationId: string
  ): Promise<boolean> {
    const caEmail = String(data["caEmail"] ?? "").trim().toLowerCase();
    if (!caEmail) return false;

    const customerEmail = data["customerEmail"] ? String(data["customerEmail"]).trim().toLowerCase() : null;
    const customerCode = data["customerCode"] ? String(data["customerCode"]).trim() : null;

    // Find CA user
    const caUser = await prisma.user.findFirst({
      where: { email: caEmail, organizationId },
      select: { id: true },
    });
    if (!caUser) return false;

    // Find customer
    const customer = await prisma.customer.findFirst({
      where: {
        organizationId,
        ...(customerEmail ? { email: customerEmail } : {}),
        ...(customerCode && !customerEmail ? { customerCode } : {}),
      },
      select: { id: true },
    });
    if (!customer) return false;

    // Check for existing active assignment
    const existing = await prisma.customerAssignment.findFirst({
      where: { customerId: customer.id, caId: caUser.id, isActive: true },
      select: { id: true },
    });
    if (existing) return true;

    // Find the org owner to set assignedById
    const orgOwner = await prisma.user.findFirst({
      where: { organizationId, role: "OWNER" },
      select: { id: true },
    });

    await prisma.customerAssignment.create({
      data: {
        customerId: customer.id,
        caId: caUser.id,
        assignedById: orgOwner?.id ?? caUser.id,
        notes: data["notes"] ? String(data["notes"]).trim() : null,
        isActive: true,
      },
    });

    return true;
  }

  // ---------------------------------------------------------------------------
  // Master import row handler
  // Creates Customer + Assignment in a single row.
  // ---------------------------------------------------------------------------
  private async processMasterImportRow(
    data: Record<string, unknown>,
    organizationId: string
  ): Promise<boolean> {
    // 1. Upsert customer
    const customerCreated = await this.upsertCustomer(data, organizationId);
    if (!customerCreated) return false;

    // 2. If assigned_ca_email provided, create assignment
    const assignedCaEmail = data["assignedCaEmail"]
      ? String(data["assignedCaEmail"]).trim().toLowerCase()
      : null;

    if (assignedCaEmail) {
      const email = String(data["email"] ?? "").trim().toLowerCase();
      await this.upsertAssignment(
        { caEmail: assignedCaEmail, customerEmail: email || null },
        organizationId
      );
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Mark import job as complete
  // ---------------------------------------------------------------------------
  private async markJobComplete(
    importJobId: string,
    result: PipelineResult
  ): Promise<void> {
    const hasFailed = result.failed > 0;
    const hasSucceeded = result.committed > 0;

    let status: "COMPLETED" | "FAILED" | "PARTIAL";
    if (!hasSucceeded && hasFailed) {
      status = "FAILED";
    } else if (hasFailed) {
      status = "PARTIAL";
    } else {
      status = "COMPLETED";
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status,
        completedAt: new Date(),
        ...(status === "FAILED" ? { failedAt: new Date() } : {}),
        processedRows: result.staged,
        successRows: result.committed,
        failedRows: result.failed,
        skippedRows: 0,
        duplicateRows: result.duplicates,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapEntityToInternal(entity: string): PipelineEntity {
  const map: Record<string, PipelineEntity> = {
    CUSTOMERS: "customer",
    VENDORS: "customer",
    INVOICES: "invoice",
    PRODUCTS: "product",
    EMPLOYEES: "employee",
    CA_USERS: "ca_user",
    FIRMS: "firm",
    ASSIGNMENTS: "assignment",
    MASTER_IMPORT: "master_import",
  };
  return map[entity?.toUpperCase()] ?? "customer";
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function normalizeInvoiceStatus(
  status: string
): "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "PARTIAL" | "VIEWED" {
  const map: Record<string, "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" | "PARTIAL" | "VIEWED"> = {
    draft: "DRAFT",
    sent: "SENT",
    paid: "PAID",
    overdue: "OVERDUE",
    cancelled: "CANCELLED",
    canceled: "CANCELLED",
    void: "CANCELLED",
    partial: "PARTIAL",
    partially_paid: "PARTIAL",
    viewed: "VIEWED",
  };
  return map[status.toLowerCase()] ?? "SENT";
}
