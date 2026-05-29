import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/middleware";
import { complianceSubmissionService } from "@/services/compliance/complianceSubmissionService";
import {
  ComplianceSubmissionSchema,
  SubmissionsQuerySchema,
} from "@/lib/validators/compliance";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requirePermission("compliance.read");
    const url = new URL(req.url);

    const rawParams = {
      status: url.searchParams.get("status") ?? undefined,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      typeId: url.searchParams.get("typeId") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      sortOrder: url.searchParams.get("sortOrder") ?? undefined,
      includeDeleted: url.searchParams.get("includeDeleted") ?? undefined,
    };

    const parsed = SubmissionsQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await complianceSubmissionService.getAll(organizationId, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_SUBMISSIONS_GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, organizationId } = await requirePermission("compliance.write");
    const body = await req.json();
    const parsed = ComplianceSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const submission = await complianceSubmissionService.create(
      parsed.data,
      organizationId,
      user.id
    );

    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[COMPLIANCE_SUBMISSIONS_POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
