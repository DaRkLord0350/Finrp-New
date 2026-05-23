import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// const isProtectedRoute = createRouteMatcher([
//   "/dashboard(.*)",
//   "/crm(.*)",
//   "/billing(.*)",
//   "/finance(.*)",
//   "/erp(.*)",
//   "/compliance(.*)",
//   "/advisor(.*)",
//   "/items(.*)",
//   "/onboarding(.*)",
//   "/api/customers(.*)",
//   "/api/invoices(.*)",
//   "/api/analytics(.*)",
//   "/api/compliance(.*)",
//   "/api/advisor(.*)",
//   "/api/items(.*)",
//   "/api/business(.*)",
//   "/api/transactions(.*)",
//   "/api/dashboard(.*)",
//   "/api/erp(.*)",
//   "/api/loans(.*)",
// ]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",   // Clerk webhooks must be unauthenticated
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

// export default clerkMiddleware(async (auth, req) => {
//   if (isProtectedRoute(req)) {
//     await auth.protect();
//   }
// });

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

