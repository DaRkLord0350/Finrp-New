import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { resolvePortalClient } from "@/lib/client-portal/context";
import { listCustomerNotifications } from "@/lib/client-portal/queries";
import {
  NotificationsClient,
  type PortalNotificationRow,
} from "@/components/portal/NotificationsClient";

export default async function CustomerNotificationsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");

  const ctx = await resolvePortalClient({
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
    firmId: user.firmId,
    userRole: user.userRole,
  });

  const rows = ctx
    ? await listCustomerNotifications(ctx.organizationId, ctx.customerId, user.id)
    : [];

  const items: PortalNotificationRow[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  return <NotificationsClient initial={items} />;
}
