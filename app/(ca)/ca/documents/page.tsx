// ============================================================
// CA Portal — Document Center
// Review (approve / reject / request re-upload), version history,
// e-sign hooks and upload across all assigned-client vault documents.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DocumentCenter, { type DocRow, type CustomerOption } from "./DocumentCenter";

export default async function DocumentsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const assignments = await prisma.customerAssignment.findMany({
    where: { caId: user.id, isActive: true },
    include: { customer: { select: { id: true, name: true } } },
  });
  const customers: CustomerOption[] = assignments.map((a) => ({ id: a.customer.id, name: a.customer.name }));
  const customerIds = customers.map((c) => c.id);

  const docs = customerIds.length
    ? await prisma.customerDocument.findMany({
        where: { customerId: { in: customerIds } },
        include: {
          reviews: { orderBy: { createdAt: "desc" }, take: 1, select: { decision: true, comment: true, signatureRequestId: true } },
          versions: { orderBy: { versionNumber: "desc" }, select: { versionNumber: true, fileUrl: true, fileName: true, createdAt: true } },
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const nameById = new Map(customers.map((c) => [c.id, c.name]));
  const rows: DocRow[] = docs.map((d) => ({
    id: d.id,
    customerId: d.customerId,
    customerName: nameById.get(d.customerId) ?? "Client",
    displayName: d.displayName,
    fileName: d.fileName,
    fileUrl: d.fileUrl,
    folder: d.folder,
    currentVersion: d.currentVersion,
    createdAt: d.createdAt.toISOString(),
    decision: d.reviews[0]?.decision ?? "NONE",
    reviewComment: d.reviews[0]?.comment ?? null,
    signatureRequested: !!d.reviews[0]?.signatureRequestId,
    versions: d.versions.map((v) => ({ versionNumber: v.versionNumber, fileUrl: v.fileUrl, fileName: v.fileName, createdAt: v.createdAt.toISOString() })),
  }));

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Document Center</h1>
        <p className="section-subtitle">Review, approve and request documents across your clients.</p>
      </div>
      <DocumentCenter rows={rows} customers={customers} />
    </div>
  );
}
