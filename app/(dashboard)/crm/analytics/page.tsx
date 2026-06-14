import { getTenantId } from "@/lib/auth/tenant";
import { customerRepository } from "@/lib/repositories";
import { redirect } from "next/navigation";
import CRMAnalyticsClient from "./CRMAnalyticsClient";

export default async function CRMAnalyticsPage() {
  const organizationId = await getTenantId();
  if (!organizationId) redirect("/sign-in");

  const [topCustomers, overdueCustomers] = await Promise.all([
    customerRepository.topByRevenue(organizationId, 10),
    customerRepository.overdueByCustomer(organizationId, 10),
  ]);

  return <CRMAnalyticsClient topCustomers={topCustomers} overdueCustomers={overdueCustomers} />;
}
