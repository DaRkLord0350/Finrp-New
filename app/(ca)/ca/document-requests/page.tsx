import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assignedCustomerIds } from "@/lib/client-portal/context";
import { listDocumentRequests } from "@/lib/client-portal/queries";
import {
  DocumentRequestsClient,
  type DocRequestRow,
  type CustomerOption,
} from "@/components/portal/DocumentRequestsClient";

export default async function CADocumentRequestsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const caId = user.userRole === "CA" ? user.id : undefined;
  const customerIds = caId ? await assignedCustomerIds(caId) : undefined;

  const [rows, customers] = await Promise.all([
    listDocumentRequests(user.organizationId, { caId, customerIds }),
    // Customers the CA can request from: their assignments, else all firm customers.
    prisma.customer.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        ...(customerIds ? { id: { in: customerIds } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  const requests: DocRequestRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    status: r.status,
    dueDate: r.dueDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    customerName: r.customer.name,
    uploads: r.uploads.map((u) => ({
      id: u.id,
      fileName: u.fileName,
      fileUrl: u.fileUrl,
      status: u.status,
      reviewNotes: u.reviewNotes,
      createdAt: u.createdAt.toISOString(),
    })),
  }));

  const customerOptions: CustomerOption[] = customers.map((c) => ({ id: c.id, name: c.name }));

  return <DocumentRequestsClient requests={requests} customers={customerOptions} />;
}
