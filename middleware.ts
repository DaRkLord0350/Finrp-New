import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { WORKSPACE_COOKIE, verifyWorkspaceToken } from "@/lib/workspace/token";

// Public routes — never require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  // Public invoice share links — authorized by token (+ optional password)
  "/i/(.*)",
  "/api/public/(.*)",
]);

// All role-based routing (CA vs CUSTOMER vs ADMIN) is handled by the
// individual layout files which read from the database — a single source
// of truth. Doing it here from Clerk JWT creates a sync-lag loop.
//
// Client Workspace duties handled at the edge:
//   1. Inject x-ws-path / x-ws-method request headers. These are SET
//      (not merged) so a client can never spoof them; the Node runtime
//      (lib/workspace/context.ts) uses them for the route → permission
//      gate and mutation audit logging. The DB assignment check itself
//      lives in the Node runtime — Prisma is not edge-safe.
//   2. Drop forged or expired workspace cookies early (HMAC verify via
//      Web Crypto, which IS edge-safe) so downstream code never sees
//      an invalid impersonation token.
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-ws-path", req.nextUrl.pathname);
  requestHeaders.set("x-ws-method", req.method);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  const wsCookie = req.cookies.get(WORKSPACE_COOKIE)?.value;
  if (wsCookie && !(await verifyWorkspaceToken(wsCookie))) {
    res.cookies.delete(WORKSPACE_COOKIE);
  }

  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
