import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = 20;

    const [auditLogs, total, apiTokens] = await Promise.all([
      prisma.auditLog.findMany({
        where: { organizationId: tenantId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { name: true, email: true, avatarUrl: true },
          },
        },
      }),
      prisma.auditLog.count({ where: { organizationId: tenantId } }),
      prisma.apiToken.findMany({
        where: { organizationId: tenantId, isActive: true },
        select: {
          id: true,
          name: true,
          tokenPrefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      auditLogs,
      total,
      page,
      pages: Math.ceil(total / limit),
      apiTokens,
    });
  } catch (error) {
    console.error("[SETTINGS_SECURITY_GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
