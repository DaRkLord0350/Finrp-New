// ============================================================
// lib/client-portal/serialize.ts
//
// Server→client DTO mappers (no Date/Decimal cross the boundary).
// ============================================================

import type { FilingApprovalRow } from "./queries";

export interface FilingDTO {
  id: string;
  type: string;
  title: string;
  period: string | null;
  summary: string | null;
  amount: string | null;
  status: string;
  customerName: string;
  customerComment: string | null;
  createdAt: string;
  decidedAt: string | null;
  documents: { id: string; fileName: string; fileUrl: string }[];
  comments: { id: string; authorName: string | null; body: string; createdAt: string }[];
}

export function serializeFiling(f: FilingApprovalRow): FilingDTO {
  return {
    id: f.id,
    type: f.type,
    title: f.title,
    period: f.period,
    summary: f.summary,
    amount: f.amount != null ? f.amount.toString() : null,
    status: f.status,
    customerName: f.customer.name,
    customerComment: f.customerComment,
    createdAt: f.createdAt.toISOString(),
    decidedAt: f.decidedAt?.toISOString() ?? null,
    documents: f.documents.map((d) => ({ id: d.id, fileName: d.fileName, fileUrl: d.fileUrl })),
    comments: f.comments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}
