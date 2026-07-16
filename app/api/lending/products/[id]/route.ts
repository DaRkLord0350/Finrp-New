import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/require-tenant";
import { mapLendingError } from "@/lib/lending/http";
import { getProduct, updateProduct, deactivateProduct } from "@/lib/lending/products";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId } = await requireTenant({ permission: "lending.read" });
    const { id } = await params;
    const product = await getProduct(id, organizationId);
    return NextResponse.json({ product });
  } catch (err) {
    return mapLendingError(err, "LENDING_PRODUCT_GET");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.manage" });
    const { id } = await params;
    const body = await req.json();
    const product = await updateProduct(id, organizationId, body, { userId });
    return NextResponse.json({ product });
  } catch (err) {
    return mapLendingError(err, "LENDING_PRODUCT_PATCH");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, organizationId } = await requireTenant({ permission: "lending.manage" });
    const { id } = await params;
    await deactivateProduct(id, organizationId, { userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    return mapLendingError(err, "LENDING_PRODUCT_DELETE");
  }
}
