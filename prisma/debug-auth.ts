import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("🔍 Checking auth context...\n");

  const { userId, orgId } = await auth();
  const tenantId = orgId || userId;

  console.log(`userId (Clerk): ${userId}`);
  console.log(`orgId (Clerk):  ${orgId}`);
  console.log(`tenantId used:  ${tenantId}\n`);

  // Check what's in the DB for this user
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId! },
    include: { organization: true },
  });

  if (dbUser) {
    console.log(`✅ User found in DB:`);
    console.log(`   Email: ${dbUser.email}`);
    console.log(`   Organization: ${dbUser.organization.name}`);
    console.log(`   Org ID: ${dbUser.organizationId}\n`);
  } else {
    console.log(`❌ User NOT found in DB\n`);
  }

  // Try to fetch customers with both IDs
  console.log(`📊 Checking customers:\n`);

  if (tenantId) {
    const customers = await prisma.customer.findMany({
      where: { organizationId: tenantId },
      take: 3,
    });
    console.log(`Customers found with tenantId (${tenantId}): ${customers.length}`);
  }

  if (dbUser) {
    const customers = await prisma.customer.findMany({
      where: { organizationId: dbUser.organizationId },
      take: 3,
    });
    console.log(`Customers found with DB orgId (${dbUser.organizationId}): ${customers.length}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
