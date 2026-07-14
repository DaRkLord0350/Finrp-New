import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizationId } from "@/lib/auth/organization";
import { upsertNote } from "@/lib/financial-statements/service";
import { generateNoteContent } from "@/lib/financial-statements/ai-mapping";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = await getOrganizationId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body?.reportId || !body?.scheduleKey || !body?.noteTitle || !Array.isArray(body?.accounts)) {
      return NextResponse.json({ error: "Missing required fields: reportId, scheduleKey, noteTitle, accounts" }, { status: 400 });
    }

    const { content } = await generateNoteContent(
      body.noteTitle,
      body.scheduleKey,
      body.accounts
    );

    const existingNotes = await prisma.statementNote.findMany({
      where: { organizationId, financialStatementId: body.reportId },
      select: { noteNumber: true },
      orderBy: { noteNumber: "desc" },
    });
    const nextNoteNumber = (existingNotes[0]?.noteNumber ?? 0) + 1;

    const note = await upsertNote({
      organizationId,
      reportId: body.reportId,
      noteNumber: nextNoteNumber,
      scheduleKey: body.scheduleKey,
      title: body.noteTitle,
      content,
      isAiGenerated: true,
    });
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error("[financial-statements/notes/ai-generate POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

