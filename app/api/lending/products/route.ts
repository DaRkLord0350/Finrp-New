import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { listProducts, createProduct } from "@/lib/lending/products";

export async function GET(req: Request) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const activeOnly = new URL(req.url).searchParams.get("activeOnly") === "true";
    const products = await listProducts(organizationId, { activeOnly });
    return NextResponse.json({ products });
  } catch (err) {
    return mapLendingError(err, "LENDING_PRODUCTS_GET");
  }
}

export async function POST(req: Request) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.manage" });
    const body = await req.json();
    const product = await createProduct(organizationId, body, { userId });
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return mapLendingError(err, "LENDING_PRODUCTS_POST");
  }
}
