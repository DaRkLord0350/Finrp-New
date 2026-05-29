import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [settings, user] = await Promise.all([
      prisma.settings.findUnique({
        where: { organizationId: tenantId },
        select: {
          emailNotifications: true,
          smsNotifications: true,
          overdueReminderDays: true,
          lowStockThreshold: true,
        },
      }),
      prisma.user.findUnique({
        where: { clerkId: userId },
        select: { notificationPreference: true },
      }),
    ]);

    return NextResponse.json({
      org: settings,
      user: user?.notificationPreference ?? {},
    });
  } catch (error) {
    console.error("[SETTINGS_NOTIFICATIONS_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { orgSettings, userPreferences } = body;

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await Promise.all([
      // Org-level settings (only OWNER/ADMIN)
      orgSettings && ["OWNER", "ADMIN"].includes(dbUser.role)
        ? prisma.settings.upsert({
            where: { organizationId: tenantId },
            create: { organizationId: tenantId, ...orgSettings },
            update: orgSettings,
          })
        : Promise.resolve(),
      // User-level preferences
      userPreferences
        ? prisma.user.update({
            where: { clerkId: userId },
            data: { notificationPreference: userPreferences },
          })
        : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SETTINGS_NOTIFICATIONS_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
