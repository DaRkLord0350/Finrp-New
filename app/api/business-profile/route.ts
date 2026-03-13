import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {

  const profile = await prisma.businessProfile.findFirst()

  if (!profile) {
    return NextResponse.json(null)
  }

  return NextResponse.json({
    organizationId: profile.organizationId,
    industry: profile.industry
  })
}