import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/auth/tenant";
import { bankVerificationService } from "@/lib/services/bank-verification.service";
import { mapBankVerificationError } from "@/lib/bank-verification/http";
import { VerifyBankAccountSchema } from "@/lib/validators/bank-verification";

type RouteCtx = { params: Promise<{ id: string }> };

// Mirrors app/api/banking/accounts/route.ts's guard convention (auth() +
// getTenantId(), no module-permission check — Banking OS routes are not
// gated by the "banking.*" permission today).
export async function POST(req: NextRequest, { params }: RouteCtx) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const organizationId = await getTenantId();
    if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

    const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = VerifyBankAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    const result = await bankVerificationService.verify(organizationId, { userId: dbUser.id }, id, parsed.data.method);
    return NextResponse.json(result);
  } catch (err) {
    return mapBankVerificationError(err, "BANK_ACCOUNT_VERIFY");
  }
}
