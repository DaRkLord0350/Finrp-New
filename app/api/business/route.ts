// ============================================================
// GET   /api/business — get current user's business
// POST  /api/business — create business (onboarding)
// PATCH /api/business — update business details
// ============================================================

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createBusiness, getBusinessByOrganization, updateBusiness } from "@/services/businessService";

export const GET = withAuth(async (_req: Request, { organizationId, user }) => {
  try {
    const business = await getBusinessByOrganization(organizationId);
    return NextResponse.json({ business });
  } catch (error) {
    console.error("[GET /api/business]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "business.read");

export const POST = withAuth(async (req: Request, { organizationId, user }) => {
  try {
    // Return existing business if already onboarded
    const existing = await getBusinessByOrganization(organizationId);
    if (existing) {
      return NextResponse.json({ business: existing });
    }

    const body = await req.json();
    const { name, type, industry, address, country, currency, taxId } = body;

    if (!name || !type || !industry || !address || !country || !currency) {
      return NextResponse.json(
        { error: "name, type, industry, address, country, and currency are required" },
        { status: 400 }
      );
    }

    const business = await createBusiness({
      organizationId,
      name,
      type,
      industry,
      address,
      country,
      currency,
      taxId: taxId || undefined,
    });

    return NextResponse.json({ business }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/business]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "business.write");

export const PATCH = withAuth(async (req: Request, { organizationId }) => {
  try {
    const body = await req.json();
    const business = await updateBusiness(organizationId, body);
    return NextResponse.json({ business });
  } catch (error) {
    console.error("[PATCH /api/business]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, "business.write");
