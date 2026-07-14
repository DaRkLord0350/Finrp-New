// ============================================================
// Organization Repository — tenant settings and profile
// ============================================================

import { prisma } from "./base.repository";

export const organizationRepository = {
  async findById(organizationId: string) {
    return prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true, plan: true, createdAt: true },
    });
  },

  async getSettings(organizationId: string) {
    return prisma.settings.findUnique({ where: { organizationId } });
  },

  async getProfile(organizationId: string) {
    return prisma.businessProfile.findUnique({ where: { organizationId } });
  },

  async getFullConfig(organizationId: string) {
    const [org, profile, settings] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, slug: true, plan: true, createdAt: true },
      }),
      prisma.businessProfile.findUnique({
        where: { organizationId },
        select: {
          businessName: true, businessType: true, registrationNo: true,
          taxId: true, gstin: true, pan: true, cin: true, industry: true,
          companySize: true, country: true, state: true, city: true,
          address: true, pincode: true, currency: true, timezone: true,
          language: true, fiscalYearType: true, logoUrl: true, websiteUrl: true, phone: true,
          // TBX Foundation (Phase 1) — Organization Master extensions
          msmeRegistrationNo: true, msmeCategory: true, operationalAddress: true,
          defaultBankAccountId: true, panVerificationStatus: true, gstVerificationStatus: true,
          cinVerificationStatus: true, tbxCustomerId: true, tbxOrganizationId: true,
          tbxStatus: true, tbxLastSyncAt: true,
        },
      }),
      prisma.settings.findUnique({
        where: { organizationId },
        select: {
          defaultTaxRate: true, taxLabel: true, taxRegistered: true,
          invoicePrefix: true, defaultPaymentTerms: true, dateFormat: true,
          numberFormat: true, inventoryEnabled: true, payrollEnabled: true,
          complianceEnabled: true, loanModuleEnabled: true, multiCurrencyEnabled: true,
        },
      }),
    ]);
    return { org, profile, settings };
  },

  async upsertProfile(organizationId: string, data: Record<string, unknown>) {
    const existing = await prisma.businessProfile.findUnique({ where: { organizationId } });
    if (existing) {
      return prisma.businessProfile.update({ where: { organizationId }, data });
    }
    return prisma.businessProfile.create({
      data: {
        organizationId,
        businessName: (data.businessName as string) ?? "My Organization",
        ...data,
      },
    });
  },

  async upsertSettings(organizationId: string, data: Record<string, unknown>) {
    return prisma.settings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  },

  async updateName(organizationId: string, name: string) {
    return prisma.organization.update({ where: { id: organizationId }, data: { name: name.trim() } });
  },
};
