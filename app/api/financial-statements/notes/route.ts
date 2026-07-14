import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { upsertNote } from "@/lib/financial-statements/service";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const reportId = req.nextUrl.searchParams.get("reportId");
    if (!reportId) {
      return NextResponse.json({ error: "Missing required query param: reportId" }, { status: 400 });
    }

    const notes = await prisma.statementNote.findMany({
      where: { organizationId, financialStatementId: reportId },
      orderBy: { noteNumber: "asc" },
    });
    return NextResponse.json(notes);
  } catch (err) {
    console.error("[financial-statements/notes GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body?.reportId || !body?.noteNumber || !body?.scheduleKey || !body?.title || !body?.content) {
      return NextResponse.json({ error: "Missing required fields: reportId, noteNumber, scheduleKey, title, content" }, { status: 400 });
    }

    const note = await upsertNote({
      organizationId,
      reportId: body.reportId,
      noteNumber: body.noteNumber,
      scheduleKey: body.scheduleKey,
      title: body.title,
      content: body.content,
      isAiGenerated: body.isAiGenerated,
    });
    return NextResponse.json(note);
  } catch (err) {
    console.error("[financial-statements/notes POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export { POST as PUT };

