// POST /api/financial-statements/seed-templates
// One-time idempotent seeder for built-in Schedule III templates.
// Safe to call multiple times (upsert by deterministic IDs).
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { seedBuiltInTemplates } from "@/lib/financial-statements/service";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await seedBuiltInTemplates();
    return NextResponse.json({ ok: true, message: "Built-in templates seeded" });
  } catch (err) {
    console.error("[seed-templates]", err);
    return NextResponse.json({ error: "Failed to seed templates" }, { status: 500 });
  }
}
