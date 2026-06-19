// ============================================================
// POST /api/chart-of-accounts/import
// Imports a Chart of Accounts CSV (multipart file or JSON { csv }).
// Column headers are case-insensitive and match the export format:
//   Code, Account Name, Type, Subtype, Parent Account, Opening Balance
// Returns per-row results { created, updated, skipped, errors[] }.
// ============================================================

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { withAuth } from "@/lib/auth/middleware";
import { accountingService } from "@/lib/services/accounting.service";
import {
  ImportAccountRowSchema,
  type ImportAccountRow,
  type ImportAccountsResult,
} from "@/lib/validators/chart-of-accounts";

const MAX_ROWS = 5000;

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export const POST = withAuth(async (req, { user, organizationId }) => {
  // ── Read CSV text from a file upload or a JSON body ──
  let csvText = "";
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    csvText = await file.text();
  } else {
    const body = await req.json().catch(() => null);
    csvText = typeof body?.csv === "string" ? body.csv : "";
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.data.length > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows (max ${MAX_ROWS})` }, { status: 400 });
  }

  const rows: ImportAccountRow[] = [];
  const parseErrors: ImportAccountsResult["errors"] = [];

  parsed.data.forEach((raw, idx) => {
    const rowNum = idx + 2; // header is line 1
    const parentRaw = pick(raw, "parent account", "parent code", "parent");
    // Export renders parent as "code — name"; codes may contain hyphens, so we
    // only split on the em-dash separator and keep the leading code.
    const parentCode = parentRaw ? parentRaw.split("—")[0].trim() || null : null;

    const candidate = {
      code: pick(raw, "code", "account code"),
      name: pick(raw, "account name", "name"),
      type: pick(raw, "type", "account type").toUpperCase(),
      subType: pick(raw, "subtype", "sub type", "account subtype") || null,
      parentCode,
      openingBalance: pick(raw, "opening balance", "openingbalance") || 0,
    };

    const result = ImportAccountRowSchema.safeParse(candidate);
    if (!result.success) {
      const first = result.error.issues[0];
      parseErrors.push({
        row: rowNum,
        code: candidate.code,
        message: `${first.path.join(".") || "row"}: ${first.message}`,
      });
    } else {
      rows.push(result.data);
    }
  });

  const result = await accountingService.importAccounts(organizationId, { userId: user.id }, rows);

  // Merge parse-time failures into the response.
  return NextResponse.json({
    ...result,
    total: result.total + parseErrors.length,
    errors: [...parseErrors, ...result.errors].sort((a, b) => a.row - b.row),
  });
}, "accounting.write");
