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

  const branding = await prisma.firmBranding.findUnique({
    where: { organizationId: admin.organizationId },
  });

  return NextResponse.json({ branding });
}

export async function PATCH(req: NextRequest) {
  const admin = await getFirmAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { logoUrl, primaryColor, secondaryColor, supportEmail, supportPhone, footerText } = body;

  const branding = await prisma.firmBranding.upsert({
    where: { organizationId: admin.organizationId },
    create: {
      organizationId: admin.organizationId,
      firmId: admin.firmId,
      logoUrl: logoUrl ?? null,
      primaryColor: primaryColor ?? null,
      secondaryColor: secondaryColor ?? null,
      supportEmail: supportEmail ?? null,
      supportPhone: supportPhone ?? null,
      footerText: footerText ?? null,
    },
    update: {
      ...(logoUrl !== undefined && { logoUrl }),
      ...(primaryColor !== undefined && { primaryColor }),
      ...(secondaryColor !== undefined && { secondaryColor }),
      ...(supportEmail !== undefined && { supportEmail }),
      ...(supportPhone !== undefined && { supportPhone }),
      ...(footerText !== undefined && { footerText }),
    },
  });

  await createAuditLog({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "SETTINGS_CHANGE",
    entity: "firm_branding",
    entityId: branding.id,
    description: "Updated firm branding settings",
  });

  return NextResponse.json({ branding });
}
