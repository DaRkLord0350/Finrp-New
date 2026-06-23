import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  TasksClient,
  type TaskRow,
  type TaskOption,
} from "@/components/firm/task/TasksClient";

export const dynamic = "force-dynamic";

export default async function FirmTasksPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const orgId = user.organizationId;

  const [tasks, customers, cas] = await Promise.all([
    prisma.firmTask.findMany({
      where: { organizationId: orgId },
      include: {
        customer: { select: { id: true, name: true } },
        assignedCa: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] }, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: TaskRow[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    customerId: t.customerId,
    customerName: t.customer.name,
    caId: t.assignedCaId,
    caName: t.assignedCa.name ?? t.assignedCa.email,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate.toISOString(),
    createdAt: t.createdAt.toISOString(),
  }));

  const customerOptions: TaskOption[] = customers.map((c) => ({ id: c.id, name: c.name }));
  const caOptions: TaskOption[] = cas.map((c) => ({ id: c.id, name: c.name ?? c.email }));

  return <TasksClient rows={rows} customers={customerOptions} cas={caOptions} />;
}
