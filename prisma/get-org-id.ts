import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get all organizations and users
  const orgs = await prisma.organization.findMany({
    include: {
      users: {
        select: {
          clerkId: true,
          email: true,
          name: true,
        },
      },
      _count: {
        select: {
          customers: true,
          items: true,
          invoices: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n📊 Found ${orgs.length} organization(s):\n`);

  orgs.forEach((org, idx) => {
    console.log(`${idx + 1}. Organization: ${org.name}`);
    console.log(`   ID: ${org.id}`);
    console.log(`   Users: ${org.users.length}`);
    org.users.forEach((u) => {
      console.log(`     - ${u.name} (${u.email}) [${u.clerkId}]`);
    });
    console.log(`   Data: ${org._count.customers} customers, ${org._count.items} items, ${org._count.invoices} invoices`);
    console.log();
  });

  console.log("\n💡 To seed your organization, run:");
  if (orgs.length > 0) {
    console.log(`\n   npx tsx prisma/seed.ts ${orgs[0].id}`);
    console.log(`\n   This will seed to: ${orgs[0].name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
