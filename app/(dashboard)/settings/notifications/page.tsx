import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import NotificationSettingsClient from "./NotificationSettingsClient";

export default async function NotificationsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const organizationId = await getTenantId();
  if (!organizationId) redirect("/sign-in");

  const [settings, user] = await Promise.all([
    prisma.settings.findUnique({
      where: { organizationId },
      select: { emailNotifications: true, smsNotifications: true, overdueReminderDays: true, lowStockThreshold: true },
    }),
    prisma.user.findUnique({
      where: { clerkId: userId },
      select: { notificationPreference: true },
    }),
  ]);

  return (
    <NotificationSettingsClient
      initialConfig={{
        org: settings ?? null,
        user: (user?.notificationPreference as Record<string, boolean>) ?? {},
      }}
    />
  );
}
