import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createBusiness, getBusinessByUser } from "@/services/businessService";

// GET /api/business — check if current user has a business
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const business = await getBusinessByUser(userId);
    return NextResponse.json({ business });
  } catch (error) {
    console.error("[GET /api/business]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/business — create business onboarding record
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if already exists
    const existing = await getBusinessByUser(userId);
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
      clerkId: userId,
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
}
