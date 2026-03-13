import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/crm(.*)",
  "/billing(.*)",
  "/finance(.*)",
  "/compliance(.*)",
  "/advisor(.*)",
  "/items(.*)",
  "/onboarding(.*)",
  "/api/customers(.*)",
  "/api/invoices(.*)",
  "/api/analytics(.*)",
  "/api/compliance(.*)",
  "/api/advisor(.*)",
  "/api/items(.*)",
  "/api/business(.*)",
  "/api/transactions(.*)",
  "/api/dashboard(.*)",
  "/api/loans(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
