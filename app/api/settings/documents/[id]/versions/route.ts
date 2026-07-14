import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getTenantId } from "@/lib/auth/tenant";
import { orgDocumentService } from "@/lib/services/org-document.service";
import { mapOrgDocumentError } from "@/lib/org-document/http";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = await getTenantId();
    if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const versions = await orgDocumentService.listVersions(tenantId, id);
    return NextResponse.json({ versions });
  } catch (error) {
    return mapOrgDocumentError(error, "SETTINGS_DOCUMENT_VERSIONS_GET");
  }
}
