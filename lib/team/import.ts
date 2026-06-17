// ============================================================
// lib/team/import.ts
//
// Excel (.xlsx) parsing, validation and template/export building
// for bulk team-member management. Uses SheetJS (already a project
// dependency). Pure functions — no DB access — so they can run in
// any route handler and be unit-tested.
// ============================================================

import * as XLSX from "xlsx";
import {
  parseFirmRole,
  parseSpecialization,
  EMAIL_REGEX,
} from "./constants";
import type { FirmMemberRole, Specialization } from "@prisma/client";

export interface ParsedRow {
  /** 1-based data row index (header excluded). */
  row: number;
  name: string;
  email: string;
  phone: string | null;
  firmRole: FirmMemberRole;
  specialization: Specialization | null;
}

export interface RowError {
  row: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ParseResult {
  valid: ParsedRow[];
  errors: RowError[];
}

const TEMPLATE_HEADERS = ["name", "email", "phone", "role", "specialization"] as const;

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Parse + validate an uploaded workbook (first sheet). Validates
 * required fields, email format, role/specialization enums, and
 * detects duplicates both within the file and against existing
 * firm emails (`opts.existingEmails`, lowercased).
 */
export function parseTeamWorkbook(
  buf: ArrayBuffer,
  opts: { existingEmails: Set<string> }
): ParseResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { valid: [], errors: [] };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets[sheetName],
    { defval: "" }
  );

  const valid: ParsedRow[] = [];
  const errors: RowError[] = [];
  const seenInFile = new Set<string>();

  rows.forEach((raw, i) => {
    const rowNum = i + 1;

    const rec: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      rec[normHeader(k)] = String(v ?? "").trim();
    }

    const data = {
      name: rec["name"] ?? "",
      email: rec["email"] ?? "",
      phone: rec["phone"] ?? "",
      role: rec["role"] ?? "",
      specialization: rec["specialization"] ?? "",
    };

    // Skip completely blank rows silently.
    if (!data.name && !data.email && !data.role) return;

    const rowErrors: string[] = [];

    if (!data.name) rowErrors.push("Name is required");

    const emailKey = data.email.toLowerCase();
    if (!data.email) rowErrors.push("Email is required");
    else if (!EMAIL_REGEX.test(data.email)) rowErrors.push("Invalid email format");
    else if (opts.existingEmails.has(emailKey)) rowErrors.push("Email already exists in firm");
    else if (seenInFile.has(emailKey)) rowErrors.push("Duplicate email in file");

    let firmRole: FirmMemberRole | null = null;
    if (!data.role) {
      rowErrors.push("Role is required");
    } else {
      firmRole = parseFirmRole(data.role);
      if (!firmRole) {
        rowErrors.push(`Invalid role "${data.role}" — use CA, Manager, Article Assistant or Admin`);
      }
    }

    let specialization: Specialization | null = null;
    if (data.specialization) {
      specialization = parseSpecialization(data.specialization);
      if (!specialization) rowErrors.push(`Invalid specialization "${data.specialization}"`);
    }

    if (rowErrors.length > 0 || !firmRole) {
      errors.push({ row: rowNum, data, errors: rowErrors });
      return;
    }

    seenInFile.add(emailKey);
    valid.push({
      row: rowNum,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      firmRole,
      specialization,
    });
  });

  return { valid, errors };
}

/** Downloadable sample template with headers + two example rows. */
export function buildSampleTemplate(): Buffer {
  const rows = [
    { name: "Rahul Sharma", email: "rahul@test.com", phone: "9999999999", role: "CA", specialization: "GST" },
    { name: "Priya Nair", email: "priya@test.com", phone: "9888877777", role: "Manager", specialization: "Income Tax" },
  ];
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...TEMPLATE_HEADERS] });
  ws["!cols"] = [{ wch: 22 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Team");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Build an export workbook from prepared rows. */
export function buildExportWorkbook(
  rows: Record<string, string | number>[],
  bookType: "xlsx" | "csv"
): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Team");
  return XLSX.write(wb, { type: "buffer", bookType }) as Buffer;
}
