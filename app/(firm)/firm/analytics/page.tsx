import { requireFirmAdmin } from "@/lib/auth/firm-admin";
import { getFirmAnalytics } from "@/lib/services/firm-analytics.service";
import FirmAnalyticsClient from "./FirmAnalyticsClient";

export default async function AnalyticsPage() {
  const user = await requireFirmAdmin();
  const data = await getFirmAnalytics(user.organizationId);
  return <FirmAnalyticsClient data={data} />;
}
