import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  CustomersClient,
  type CustomerRow,
  type CaOption,
} from "@/components/firm/customer/CustomersClient";

export const dynamic = "force-dynamic";

export default async function FirmCustomersPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const orgId = user.organizationId;

  const [customers, cas] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: {
        id: true,
        name: true,
        company: true,
        gstin: true,
        email: true,
        phone: true,
        customerType: true,
        isActive: true,
        createdAt: true,
        customerAssignments: {
          where: { isActive: true },
          select: { ca: { select: { id: true, name: true, email: true } } },
          take: 1,
        },
        _count: { select: { firmTasks: { where: { status: { not: "COMPLETED" } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, userRole: { in: ["CA", "CA_FIRM_ADMIN"] }, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: CustomerRow[] = customers.map((c) => {
    const assignedCa = c.customerAssignments[0]?.ca ?? null;
    return {
      id: c.id,
      name: c.name,
      company: c.company,
      gstin: c.gstin,
      email: c.email,
      phone: c.phone,
      customerType: c.customerType,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      assignedCaId: assignedCa?.id ?? null,
      assignedCaName: assignedCa ? assignedCa.name ?? assignedCa.email : null,
      openTasks: c._count.firmTasks,
    };
  });

  const caOptions: CaOption[] = cas.map((c) => ({ id: c.id, name: c.name ?? c.email }));

  return <CustomersClient rows={rows} cas={caOptions} />;
}
