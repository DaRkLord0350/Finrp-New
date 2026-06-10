import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { getTenantId } from "@/lib/auth/tenant";
import { exchangePublicToken, syncTransactions, syncBalances, getAccounts } from "@/lib/banking/integrations/plaid-client";
import { plaidExchangeSchema } from "@/lib/banking/validations";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getTenantId();
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  try {
    const body = await req.json();
    const parsed = plaidExchangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", issues: parsed.error.issues }, { status: 422 });
    }

    const { publicToken, institutionName, institutionId, bankAccountId, accountIds } = parsed.data;

    const { connectionId } = await exchangePublicToken(publicToken, orgId, {
      institutionName,
      institutionId,
      bankAccountId,
    });

    // Fetch accounts from Plaid and create BankAccount records
    const plaidAccounts = await getAccounts(connectionId);
    const createdAccounts: string[] = [];

    for (const plaidAcc of plaidAccounts) {
      if (accountIds && !accountIds.includes(plaidAcc.account_id)) continue;

      const existing = await prisma.bankAccount.findFirst({
        where: {
          organizationId: orgId,
          metadata: { path: ["plaidAccountId"], equals: plaidAcc.account_id },
        },
      });

      if (!existing) {
        const newAcc = await prisma.bankAccount.create({
          data: {
            organizationId: orgId,
            connectionId,
            accountName: plaidAcc.official_name ?? plaidAcc.name,
            bankName: institutionName ?? "Plaid Bank",
            accountNumber: `****${plaidAcc.mask ?? "0000"}`,
            maskedNumber: `XXXX XXXX ${plaidAcc.mask ?? "0000"}`,
            accountType: mapPlaidAccountType(plaidAcc.type, plaidAcc.subtype ?? "") as never,
            currency: plaidAcc.balances.iso_currency_code ?? "USD",
            currentBalance: plaidAcc.balances.current ?? 0,
            availableBalance: plaidAcc.balances.available ?? 0,
            autoSyncEnabled: true,
            metadata: { plaidAccountId: plaidAcc.account_id, plaidType: plaidAcc.type },
          },
        });
        createdAccounts.push(newAcc.id);
      }
    }

    // Initial sync
    await syncTransactions(connectionId, orgId);
    await syncBalances(connectionId, orgId);

    await createAuditLog({
      organizationId: orgId,
      userId,
      action: "CREATE",
      entity: "BankConnection",
      entityId: connectionId,
      description: `Connected Plaid bank: ${institutionName ?? "Unknown"}`,
    });

    return NextResponse.json({ connectionId, accountsCreated: createdAccounts.length }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "banking", action: "plaid-exchange" } });
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function mapPlaidAccountType(type: string, subtype: string): string {
  const typeMap: Record<string, string> = {
    depository: subtype === "savings" ? "SAVINGS" : "CURRENT",
    credit: "CASH_CREDIT",
    loan: "OVERDRAFT",
    investment: "FIXED_DEPOSIT",
    other: "CURRENT",
  };
  return typeMap[type.toLowerCase()] ?? "CURRENT";
}
