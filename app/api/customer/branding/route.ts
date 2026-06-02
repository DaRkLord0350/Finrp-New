// Customer portal reads their firm's branding
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ branding: null });

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { organizationId: true },
  });
  if (!user) return NextResponse.json({ branding: null });

  // Find the CA firm that manages this customer's org
  // Look up via CustomerAssignment → CA user → their org branding
  const assignment = await prisma.customerAssignment.findFirst({
    where: {
      customer: { organizationId: user.organizationId },
      isActive: true,
    },
    include: {
      ca: { select: { organizationId: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  if (!assignment) return NextResponse.json({ branding: null });

  const branding = await prisma.firmBranding.findUnique({
    where: { organizationId: assignment.ca.organizationId },
  });

  return NextResponse.json({ branding });
}
