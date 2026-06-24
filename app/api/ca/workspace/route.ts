// ============================================================
// /api/ca/workspace — Client Workspace session management
//
//   GET    → current workspace status (banner / switcher data)
//   POST   → enter (or switch to) a client workspace
//   DELETE → exit the workspace
//
// Entering validates the caller's role and their ClientAssignment
// (ADMIN bypasses), then sets the signed httpOnly cookie that
// lib/workspace/context.ts validates on every subsequent request.
// Every boundary event is written to ClientActivityLog.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import {
  WORKSPACE_COOKIE,
  WORKSPACE_TTL_SECONDS,
  createWorkspaceToken,
  verifyWorkspaceToken,
} from "@/lib/workspace/token";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { resolveWorkspaceAccess } from "@/lib/workspace/assignments";
import { recordClientActivity } from "@/lib/workspace/audit";

function requestMeta(req: NextRequest) {
  return {
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// GET — workspace status for ClientBanner / CustomerSwitcher
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const ws = await getWorkspaceContext();
    if (!ws) return NextResponse.json({ active: false });

    const organization = await prisma.organization.findUnique({
      where: { id: ws.organizationId },
      select: {
        id: true,
        name: true,
        businessProfile: { select: { businessName: true, gstin: true } },
      },
    });
    if (!organization) return NextResponse.json({ active: false });

    return NextResponse.json({
      active: true,
      organization: {
        id: organization.id,
        name: organization.businessProfile?.businessName ?? organization.name,
        gstin: organization.businessProfile?.gstin ?? null,
      },
      permissions: ws.permissions,
      isSuperAdmin: ws.isSuperAdmin,
    });
  } catch (error) {
    console.error("[GET /api/ca/workspace]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — enter / switch workspace
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.userRole || user.userRole === "CUSTOMER") {
      return NextResponse.json(
        { error: "Only CA users can open client workspaces" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const organizationId: string | undefined = body?.organizationId;
    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    // A CA must never "impersonate" their own practice org.
    if (organizationId === user.organizationId) {
      return NextResponse.json(
        { error: "Cannot open a workspace for your own organization" },
        { status: 400 }
      );
    }

    const access = await resolveWorkspaceAccess(
      { id: user.id, userRole: user.userRole, firmId: user.firmId },
      organizationId
    );
    const meta = requestMeta(req);

    if (!access.allowed) {
      await recordClientActivity({
        caUserId: user.id,
        organizationId,
        action: "PERMISSION_DENIED",
        summary: `Workspace entry denied — no active assignment for ${user.email}`,
        path: "/api/ca/workspace",
        method: "POST",
        ...meta,
      });
      return NextResponse.json(
        { error: "You are not assigned to this client" },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        businessProfile: { select: { businessName: true } },
      },
    });
    if (!organization) {
      return NextResponse.json({ error: "Client organization not found" }, { status: 404 });
    }

    // Switch vs fresh entry — purely for accurate audit semantics.
    const previous = await verifyWorkspaceToken(req.cookies.get(WORKSPACE_COOKIE)?.value);
    const isSwitch = !!previous && previous.orgId !== organizationId && previous.uid === user.id;

    if (isSwitch && previous) {
      await recordClientActivity({
        caUserId: user.id,
        organizationId: previous.orgId,
        action: "WORKSPACE_EXIT",
        summary: `Exited workspace (switching clients)`,
        path: "/api/ca/workspace",
        method: "POST",
        ...meta,
      });
    }

    const token = await createWorkspaceToken({
      orgId: organizationId,
      uid: user.id,
      cid: user.clerkId,
    });

    await recordClientActivity({
      caUserId: user.id,
      organizationId,
      action: isSwitch ? "WORKSPACE_SWITCH" : "WORKSPACE_ENTER",
      summary: `${user.name ?? user.email} entered workspace of "${
        organization.businessProfile?.businessName ?? organization.name
      }"`,
      path: "/api/ca/workspace",
      method: "POST",
      metadata: { assignmentId: access.assignmentId, role: user.userRole },
      ...meta,
    });

    const res = NextResponse.json({
      ok: true,
      redirect: "/dashboard",
      organization: {
        id: organization.id,
        name: organization.businessProfile?.businessName ?? organization.name,
      },
      permissions: access.permissions,
    });
    res.cookies.set(WORKSPACE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: WORKSPACE_TTL_SECONDS,
    });
    return res;
  } catch (error) {
    console.error("[POST /api/ca/workspace]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — exit workspace
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    let user;
    try {
      user = await getCurrentUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyWorkspaceToken(req.cookies.get(WORKSPACE_COOKIE)?.value);
    if (payload && payload.uid === user.id) {
      await recordClientActivity({
        caUserId: user.id,
        organizationId: payload.orgId,
        action: "WORKSPACE_EXIT",
        summary: `${user.name ?? user.email} exited the client workspace`,
        path: "/api/ca/workspace",
        method: "DELETE",
        ...requestMeta(req),
      });
    }

    const redirect =
      user.userRole === "ADMIN" ? "/admin"
      : user.userRole === "CA_FIRM_ADMIN" ? "/firm"
      : "/ca/virtual-access";

    const res = NextResponse.json({ ok: true, redirect });
    res.cookies.delete(WORKSPACE_COOKIE);
    return res;
  } catch (error) {
    console.error("[DELETE /api/ca/workspace]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
