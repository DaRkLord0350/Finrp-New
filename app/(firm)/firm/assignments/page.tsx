import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  AssignmentsClient,
  type AssignCustomer,
  type AssignCa,
  type AssignHistoryRow,
} from "@/components/firm/customer/AssignmentsClient";

export const dynamic = "force-dynamic";

export default async function FirmAssignmentsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const orgId = user.organizationId;

  const [customers, cas, history] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        company: true,
        isActive: true,
        customerAssignments: {
          where: { isActive: true },
          select: { ca: { select: { id: true, name: true, email: true } } },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] }, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        _count: { select: { customerAssignments: { where: { isActive: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.customerAssignment.findMany({
      where: { customer: { organizationId: orgId } },
      include: {
        customer: { select: { name: true } },
        ca: { select: { name: true, email: true } },
        assignedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const customerRows: AssignCustomer[] = customers.map((c) => {
    const ca = c.customerAssignments[0]?.ca ?? null;
    return {
      id: c.id,
      name: c.name,
      company: c.company,
      isActive: c.isActive,
      assignedCaId: ca?.id ?? null,
      assignedCaName: ca ? ca.name ?? ca.email : null,
    };
  });

  const caRows: AssignCa[] = cas.map((c) => ({
    id: c.id,
    name: c.name ?? c.email,
    customerCount: c._count.customerAssignments,
  }));

  const historyRows: AssignHistoryRow[] = history.map((h) => ({
    id: h.id,
    customerName: h.customer.name,
    caName: h.ca.name ?? h.ca.email,
    assignedByName: h.assignedBy.name ?? null,
    reason: h.reason,
    isActive: h.isActive,
    assignedAt: h.assignedAt.toISOString(),
    unassignedAt: h.unassignedAt?.toISOString() ?? null,
  }));

  return <AssignmentsClient customers={customerRows} cas={caRows} history={historyRows} />;
}
