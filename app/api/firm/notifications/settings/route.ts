import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";

async function getFirmAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.userRole !== "CA_FIRM_ADMIN") return null;
  return user;
}

export async function GET() {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.firmNotificationSettings.findUnique({
    where: { organizationId: admin.organizationId },
  });

  // Return settings without sensitive keys in full
  const safeSettings = settings
    ? {
        ...settings,
        resendApiKey: settings.resendApiKey ? "••••••••" + settings.resendApiKey.slice(-4) : null,
        twilioAccountSid: settings.twilioAccountSid ? "••••" + settings.twilioAccountSid.slice(-4) : null,
        twilioAuthToken: settings.twilioAuthToken ? "••••" : null,
      }
    : null;

  return NextResponse.json({ settings: safeSettings });
}

export async function PATCH(req: NextRequest) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Strip masked values to avoid overwriting real keys with placeholders
  const cleanBody = { ...body };
  if (cleanBody.resendApiKey?.startsWith("••••")) delete cleanBody.resendApiKey;
  if (cleanBody.twilioAccountSid?.startsWith("••••")) delete cleanBody.twilioAccountSid;
  if (cleanBody.twilioAuthToken?.startsWith("••••")) delete cleanBody.twilioAuthToken;

  const settings = await prisma.firmNotificationSettings.upsert({
    where: { organizationId: admin.organizationId },
    create: {
      organizationId: admin.organizationId,
      firmId: admin.firmId,
      ...cleanBody,
    },
    update: cleanBody,
  });

  await createAuditLog({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "SETTINGS_CHANGE",
    entity: "firm_notification_settings",
    description: "Updated firm notification settings",
  });

  // Return masked
  return NextResponse.json({
    settings: {
      ...settings,
      resendApiKey: settings.resendApiKey ? "••••••••" + settings.resendApiKey.slice(-4) : null,
      twilioAccountSid: settings.twilioAccountSid ? "••••" + settings.twilioAccountSid.slice(-4) : null,
      twilioAuthToken: settings.twilioAuthToken ? "••••" : null,
    },
  });
}
