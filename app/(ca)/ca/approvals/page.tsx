import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assignedCustomerIds } from "@/lib/client-portal/context";
import { listFilingApprovals } from "@/lib/client-portal/queries";
import { serializeFiling } from "@/lib/client-portal/serialize";
import {
  FilingApprovalsClient,
  type CustomerOption,
} from "@/components/portal/FilingApprovalsClient";

export default async function CAApprovalsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const caId = user.userRole === "CA" ? user.id : undefined;
  const customerIds = caId ? await assignedCustomerIds(caId) : undefined;

  const [rows, customers] = await Promise.all([
    listFilingApprovals(user.organizationId, { caId, customerIds }),
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

  const filings = rows.map(serializeFiling);
  const customerOptions: CustomerOption[] = customers.map((c) => ({ id: c.id, name: c.name }));

  return <FilingApprovalsClient filings={filings} mode="ca" customers={customerOptions} />;
}
