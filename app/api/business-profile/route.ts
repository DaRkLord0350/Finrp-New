import { NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/middleware"
import { prisma } from "@/lib/prisma"

export const GET = withAuth(async (_req: Request, { organizationId }) => {
  const profile = await prisma.businessProfile.findUnique({
    where: { organizationId }
  })

  if (!profile) {
    return NextResponse.json(null)
  }

  return NextResponse.json({
    organizationId: profile.organizationId,
    industry: profile.industry
  })
}, "business.read")