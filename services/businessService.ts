import { prisma } from "@/lib/prisma";

export interface CreateBusinessData {
  clerkId: string;
  name: string;
  type: string;
  industry: string;
  address: string;
  country: string;
  currency: string;
  taxId?: string;
}

export async function createBusiness(data: CreateBusinessData) {
  return prisma.business.create({ data });
}

export async function getBusinessByUser(clerkId: string) {
  return prisma.business.findUnique({
    where: { clerkId },
  });
}

export async function updateBusiness(
  clerkId: string,
  data: Partial<Omit<CreateBusinessData, "clerkId">>
) {
  return prisma.business.update({
    where: { clerkId },
    data,
  });
}
