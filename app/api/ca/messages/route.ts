import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/middleware";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth();
    if (user.userRole === "CUSTOMER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { organizationId, subject, body, templateType } = (await req.json()) as {
      organizationId: string;
      subject: string;
      body: string;
      templateType?: string;
    };

    if (!organizationId || !subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify this org belongs to one of this CA's clients
    const caClient = await prisma.cAClient.findFirst({
      where: { caUserId: user.id, organizationId, isActive: true },
    });
    if (!caClient) {
      return NextResponse.json({ error: "Organization not in your client list" }, { status: 403 });
    }

    const message = await prisma.cAMessage.create({
      data: {
        caUserId: user.id,
        organizationId,
        subject: subject.trim(),
        body: body.trim(),
        templateType: templateType ?? null,
      },
    });

    return NextResponse.json({ success: true, messageId: message.id }, { status: 201 });
  } catch (error) {
    console.error("[CA messages POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
