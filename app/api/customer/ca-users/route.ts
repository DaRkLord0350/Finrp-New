import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get CAs assigned to this user's organization
  const caClients = await prisma.cAClient.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    include: {
      caUser: { select: { id: true, name: true, email: true } },
    },
  });

  const caUsers = caClients.map((c) => c.caUser);

  return NextResponse.json({ caUsers });
}
