// ============================================================
// lib/ca/checklist.ts
//
// Per-client required-document checklist. A customer's checklist is
// seeded lazily on first view with the statutory document set; item
// status is reconciled against the customer's uploaded
// CustomerDocuments (vault).
// ============================================================

import { prisma } from "@/lib/prisma";
import type {
  ClientChecklistDocType,
  ClientChecklistItemStatus,
  DocumentFolder,
  Prisma,
} from "@prisma/client";

interface DefaultDoc {
  docType: ClientChecklistDocType;
  label: string;
  sortOrder: number;
}

// Statutory document set every onboarding client must provide.
export const DEFAULT_CHECKLIST_DOCS: DefaultDoc[] = [
  { docType: "PAN", label: "PAN Card", sortOrder: 0 },
  { docType: "GST", label: "GST Registration Certificate", sortOrder: 1 },
  { docType: "COI", label: "Certificate of Incorporation", sortOrder: 2 },
  { docType: "AADHAAR", label: "Aadhaar (Authorised Signatory)", sortOrder: 3 },
  { docType: "BANK_STATEMENT", label: "Bank Statement", sortOrder: 4 },
  { docType: "MOA", label: "Memorandum of Association", sortOrder: 5 },
  { docType: "AOA", label: "Articles of Association", sortOrder: 6 },
  { docType: "ITR", label: "Latest Income Tax Return", sortOrder: 7 },
];

export const CHECKLIST_STATUS_META: Record<
  ClientChecklistItemStatus,
  { label: string; color: string }
> = {
  UPLOADED: { label: "Uploaded", color: "#10b981" },
  PENDING_REVIEW: { label: "Pending Review", color: "#f59e0b" },
  MISSING: { label: "Missing", color: "#94a3b8" },
  EXPIRED: { label: "Expired", color: "#ef4444" },
};

// Vault folder → checklist docType, used to auto-link uploaded docs.
const FOLDER_TO_DOCTYPE: Partial<Record<DocumentFolder, ClientChecklistDocType>> = {
  GST: "GST",
  INCOME_TAX: "ITR",
  BANK_STATEMENTS: "BANK_STATEMENT",
};

/**
 * Returns the customer's checklist, creating it (and the default items)
 * on first access. Idempotent — missing default items are back-filled.
 */
export async function ensureChecklist(
  customerId: string,
  organizationId: string,
  createdById?: string | null
) {
  let checklist = await prisma.clientChecklist.findUnique({
    where: { customerId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!checklist) {
    checklist = await prisma.clientChecklist.create({
      data: {
        customerId,
        organizationId,
        createdById: createdById ?? null,
        items: {
          create: DEFAULT_CHECKLIST_DOCS.map((d) => ({
            docType: d.docType,
            label: d.label,
            sortOrder: d.sortOrder,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    return checklist;
  }

  // Back-fill any default doc types missing from an older checklist.
  const present = new Set(checklist.items.map((i) => i.docType));
  const missing = DEFAULT_CHECKLIST_DOCS.filter((d) => !present.has(d.docType));
  if (missing.length > 0) {
    await prisma.clientChecklistItem.createMany({
      data: missing.map((d) => ({
        checklistId: checklist!.id,
        docType: d.docType,
        label: d.label,
        sortOrder: d.sortOrder,
      })),
    });
    checklist = await prisma.clientChecklist.findUnique({
      where: { customerId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  }

  return checklist!;
}

/**
 * Reconcile checklist item statuses against the customer's uploaded vault
 * documents: link a matching folder's document and flip MISSING → uploaded.
 * Items already UPLOADED/EXPIRED/PENDING_REVIEW are left as set by reviews.
 */
export async function reconcileChecklistStatuses(customerId: string) {
  const checklist = await prisma.clientChecklist.findUnique({
    where: { customerId },
    include: { items: true },
  });
  if (!checklist) return;

  const docs = await prisma.customerDocument.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, folder: true },
  });

  const updates: Promise<unknown>[] = [];
  for (const item of checklist.items) {
    if (item.customerDocumentId) continue; // already linked
    const match = docs.find((d) => FOLDER_TO_DOCTYPE[d.folder] === item.docType);
    if (match && item.status === "MISSING") {
      updates.push(
        prisma.clientChecklistItem.update({
          where: { id: item.id },
          data: { customerDocumentId: match.id, status: "PENDING_REVIEW" },
        })
      );
    }
  }
  if (updates.length) await Promise.all(updates);
}

export function checklistCounts(
  items: { status: ClientChecklistItemStatus }[]
): { total: number; uploaded: number; missing: number; pending: number; expired: number } {
  return {
    total: items.length,
    uploaded: items.filter((i) => i.status === "UPLOADED").length,
    missing: items.filter((i) => i.status === "MISSING").length,
    pending: items.filter((i) => i.status === "PENDING_REVIEW").length,
    expired: items.filter((i) => i.status === "EXPIRED").length,
  };
}

export type ChecklistWithItems = Prisma.ClientChecklistGetPayload<{
  include: { items: true };
}>;
