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

    const [org, profile, settings] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          createdAt: true,
        },
      }),
      prisma.businessProfile.findUnique({
        where: { organizationId: tenantId },
        select: {
          businessName: true,
          businessType: true,
          registrationNo: true,
          taxId: true,
          gstin: true,
          pan: true,
          cin: true,
          industry: true,
          companySize: true,
          country: true,
          state: true,
          city: true,
          address: true,
          pincode: true,
          currency: true,
          timezone: true,
          language: true,
          fiscalYearType: true,
          logoUrl: true,
          websiteUrl: true,
          phone: true,
        },
      }),
      prisma.settings.findUnique({
        where: { organizationId: tenantId },
        select: {
          defaultTaxRate: true,
          taxLabel: true,
          taxRegistered: true,
          invoicePrefix: true,
          defaultPaymentTerms: true,
          dateFormat: true,
          numberFormat: true,
          inventoryEnabled: true,
          payrollEnabled: true,
          complianceEnabled: true,
          loanModuleEnabled: true,
          multiCurrencyEnabled: true,
        },
      }),
    ]);

    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    return NextResponse.json({ org, profile, settings });
  } catch (error) {
    console.error("[SETTINGS_ORG_GET]", error);
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
    const { orgName, profile: profileData, settings: settingsData } = body;

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Only OWNER/ADMIN can update org settings
    if (!["OWNER", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      if (orgName) {
        await tx.organization.update({
          where: { id: tenantId },
          data: { name: orgName.trim() },
        });
      }

      if (profileData) {
        const profileExists = await tx.businessProfile.findUnique({
          where: { organizationId: tenantId },
        });

        const cleanProfile = Object.fromEntries(
          Object.entries(profileData).filter(([, v]) => v !== undefined)
        );

        if (profileExists) {
          await tx.businessProfile.update({
            where: { organizationId: tenantId },
            data: cleanProfile,
          });
        } else {
          await tx.businessProfile.create({
            data: {
              organizationId: tenantId,
              businessName: profileData.businessName || orgName || "My Organization",
              ...cleanProfile,
            },
          });
        }
      }

      if (settingsData) {
        const cleanSettings = Object.fromEntries(
          Object.entries(settingsData).filter(([, v]) => v !== undefined)
        );

        await tx.settings.upsert({
          where: { organizationId: tenantId },
          create: { organizationId: tenantId, ...cleanSettings },
          update: cleanSettings,
        });
      }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: tenantId,
        userId: dbUser.id,
        action: "SETTINGS_CHANGE",
        entity: "organization",
        entityId: tenantId,
        description: "Updated organization settings",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SETTINGS_ORG_PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
