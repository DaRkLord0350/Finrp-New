import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { createHash, randomBytes } from "crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser || !["OWNER", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, scopes, expiresInDays } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Token name required" }, { status: 400 });
    }

    const rawToken = `fnrp_${randomBytes(32).toString("hex")}`;
    const tokenHash = hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 12);

    let expiresAt: Date | null = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(expiresInDays));
    }

    const token = await prisma.apiToken.create({
      data: {
        organizationId: tenantId,
        name: name.trim(),
        tokenHash,
        tokenPrefix,
        scopes: scopes ?? [],
        expiresAt,
        createdById: dbUser.id,
      },
    });

    // Return raw token ONCE — never stored again
    return NextResponse.json(
      {
        id: token.id,
        name: token.name,
        token: rawToken,
        tokenPrefix,
        scopes: token.scopes,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API_TOKENS_POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser || !["OWNER", "ADMIN"].includes(dbUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get("id");
    if (!tokenId) return NextResponse.json({ error: "id required" }, { status: 400 });

    const token = await prisma.apiToken.findFirst({
      where: { id: tokenId, organizationId: tenantId },
    });
    if (!token) return NextResponse.json({ error: "Token not found" }, { status: 404 });

    await prisma.apiToken.update({
      where: { id: tokenId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API_TOKENS_DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
