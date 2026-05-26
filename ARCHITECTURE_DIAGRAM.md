# FinRP Enterprise RBAC — Architecture Diagram

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER REQUEST                              │
│                        (HTTP/Browser)                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
            ┌────────────────────────────────┐
            │  Clerk Authentication Layer    │
            │  (middleware.ts)               │
            │  - Validates JWT               │
            │  - Extracts userId             │
            └─────────────┬────────────────┘
                          │
              ┌───────────┴───────────┐
              │ Authenticated?        │
              ├───────────┬───────────┤
              │ No        │ Yes       │
              ▼           ▼           
          REJECT      CONTINUE        
          401             │           
                          ▼           
        ┌────────────────────────────────────┐
        │  Load User from Database           │
        │  (getCurrentUser)                  │
        │  - Fetch User record               │
        │  - Get role                        │
        │  - Get organizationId              │
        └─────────────┬──────────────────────┘
                      │
        ┌─────────────┴──────────────┬──────────────┐
        │                            │              │
        │ Request Type?              │              │
        │                            │              │
        ▼                            ▼              ▼
    API ROUTE                   PAGE ROUTE     SIDEBAR/UI
    
┌──────────────────────────────────────────────────────────────────┐
│ API AUTHORIZATION LAYER (withAuth Middleware)                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. Check authentication (done in middleware)                    │
│ 2. Load user permissions from rolePermissions matrix            │
│ 3. Check if user has required permission                        │
│ 4. Validate organizationId                                      │
│                                                                  │
│ Response:                                                        │
│ ├─ Permission ✓ → Execute handler, access database              │
│ ├─ Permission ✗ → Return 403 Forbidden                          │
│ └─ Not auth → Return 401 Unauthorized (never reaches here)      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
    │ ✓ ALLOWED
    ▼
Handler executes:
- Access user context
- Access organizationId
- Query database (filtered by organizationId)
- Return data
    │
    ▼
Return 200 OK with data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────────────────────────────────────────────────┐
│ PAGE AUTHORIZATION LAYER (requirePagePermission)                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Runs at page render time:                                       │
│ 1. Call requirePagePermission("permission.required")            │
│ 2. Load user + permissions                                      │
│ 3. Check if user has required permission                        │
│                                                                  │
│ Result:                                                          │
│ ├─ Permission ✓ → Render page component                         │
│ ├─ Permission ✗ → redirect("/forbidden")                        │
│ └─ Not auth → redirect("/sign-in")                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
    │ ✓ ALLOWED
    ▼
Page renders with full access to:
- User context
- organizationId
- Database queries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────────────────────────────────────────────────┐
│ UI AUTHORIZATION LAYER (Can Component)                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Conditional rendering in React/Next.js:                        │
│                                                                  │
│ <Can permission="action.write">                                 │
│   <Button>Perform Action</Button>                               │
│ </Can>                                                           │
│                                                                  │
│ Result:                                                          │
│ ├─ Permission ✓ → Render children                               │
│ ├─ Permission ✗ → Render nothing (or fallback)                  │
│ └─ Loading → Render nothing until checked                       │
│                                                                  │
│ NOTE: This is VISUAL ONLY - real security is on backend         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
    │ ✓ VISIBLE
    ▼
Button/Component shows to user
User can click it
Frontend sends request to API
API validates again (Layer 2)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────────────────────────────────────────────────┐
│ SIDEBAR AUTHORIZATION LAYER                                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Dynamic sidebar filtering:                                      │
│ 1. Sidebar component loads                                      │
│ 2. getVisibleSidebarItems(sidebarNavItems) called               │
│ 3. For each item, check user's permission                       │
│ 4. Filter out items user can't access                           │
│ 5. Render only visible items                                    │
│                                                                  │
│ Example: STAFF role                                             │
│ └─ Dashboard (dashboard.read) ✓ VISIBLE                         │
│ └─ CRM (customers.read) ✓ VISIBLE                               │
│ └─ Finance (finance.read) ✗ HIDDEN                              │
│ └─ Compliance (compliance.read) ✗ HIDDEN                        │
│ └─ Settings (settings.read) ✗ HIDDEN                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
    │ Visible items rendered
    ▼
Sidebar displays:
- Dashboard link
- CRM link
(Finance, Compliance, Settings not shown)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Data Flow Diagram

USER LOGS IN
    │
    ▼
Clerk Authenticates
    │
    ▼
JWT Token Created
    │
    ▼
User Makes Request (API, Page, or Navigation)
    │
    ├─────────────────────────────────┬────────────────┬──────────────┐
    │                                 │                │              │
    ▼                                 ▼                ▼              ▼
API Request                      Page Load          Navigation    Sidebar Init
    │                                 │                │              │
    ▼                                 ▼                ▼              ▼
withAuth Wrapper            requirePagePermission  No guard      getVisibleSidebarItems
    │                                 │                │              │
    ├─Check auth                      ├─Check auth     │              ├─Check auth
    ├─Check permission                ├─Check permission             ├─Check permission
    ├─Validate organizationId         ├─Validate organizationId      ├─Filter items
    │                                 │                │              │
    ▼                                 ▼                ▼              ▼
✓ Permission?                   ✓ Permission?       Allowed?     ✓ Visible?
    │                                 │                │              │
    ├─ YES → Execute handler          ├─ YES → Render page          ├─ YES → Show item
    └─ NO → 403 Forbidden             └─ NO → Redirect /forbidden   └─ NO → Hide item

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Permission Matrix Structure

lib/auth/permissions.ts:

rolePermissions = {
  SUPER_ADMIN: ["*"],  // All permissions
  
  ADMIN: [
    "dashboard.read",
    "customers.read", "customers.write", "customers.delete",
    "invoices.read", "invoices.write", "invoices.approve",
    ... (35+ permissions)
  ],
  
  CA: [
    "dashboard.read",
    "finance.read", "finance.write",
    "compliance.read", "compliance.write", "compliance.approve",
    ... (20+ permissions)
  ],
  
  ACCOUNTANT: [
    "dashboard.read",
    "invoices.read", "invoices.write",
    "finance.read", "finance.write",
    ... (15+ permissions)
  ],
  
  STAFF: [
    "dashboard.read",
    "customers.read", "customers.write",
    "inventory.read", "inventory.write",
    ... (8+ permissions)
  ],
  
  VIEWER: [
    "dashboard.read",
    "analytics.read",
    "reports.export",
    ... (5+ read-only permissions)
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Organization Isolation

Every database query includes organizationId filter:

BEFORE (Insecure):
  const customers = await prisma.customer.findMany({
    where: { /* no org filter */ },  // ✗ All orgs!
  });

AFTER (Secure):
  const customers = await prisma.customer.findMany({
    where: { organizationId },  // ✓ Only this org
  });

API Context provides organizationId:
  export const GET = withAuth(async (req, { organizationId }) => {
    // organizationId auto-provided by withAuth
    // Always filtered in queries
  }, "customers.read");

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Security Guarantee Chain

Request → Clerk Auth ✓ → User in DB ✓ → Has Role ✓ → Has Permission ✓
           → Access Granted ✓ → organizationId Validated ✓
           → Database Query Filtered ✓ → Data Returned ✓
           → Response Sent Securely ✓

At ANY point in chain:
├─ No authentication → 401 Unauthorized
├─ No permission → 403 Forbidden
├─ organizationId mismatch → No data returned / 403
└─ Invalid role → No permissions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## File Structure & Dependencies

lib/auth/
  ├─ permissions.ts ─────┐
  │                       ├─ access.ts
  │                       │   └─ Used by: Can.tsx, pageGuard.ts
  ├─ session.ts ─────────┤
  │                       └─ sidebar.ts
  ├─ middleware.ts ──────┐    └─ Used by: Sidebar.tsx
  │                       └─ API routes
  └─ pageGuard.ts ─────────── Used by: Pages
  
components/
  ├─ auth.tsx ────────────── <Can permission="..." />
  │   └─ Uses: access.ts functions
  │
  └─ Sidebar.tsx ─────────── Dynamic sidebar
      └─ Uses: sidebar.ts functions

constants/
  └─ sidebar.ts ──────────── Config for sidebar items

app/
  └─ api/
      ├─ customers/route.ts
      │   └─ Uses: withAuth wrapper
      ├─ invoices/route.ts
      │   └─ Uses: withAuth wrapper
      └─ ... (30+ more routes)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Typical Request Flow Example

REQUEST: GET /api/customers (from CA user)

1. Middleware checks: Is JWT valid?
   → Yes, extract userId

2. getCurrentUser():
   → Load user from DB
   → Get role: "CA"
   → Get organizationId: "org_123"

3. withAuth wrapper checks permission:
   → Permission required: "customers.read"
   → User role: CA
   → rolePermissions[CA] includes "customers.read"? Yes ✓

4. Handler executes:
   → organizationId provided: "org_123"
   → Query: prisma.customer.findMany({
       where: { organizationId: "org_123" }
     })
   → Returns only org_123 customers

5. Response sent:
   → 200 OK
   → [Customer objects from org_123 only]

If permission denied:
   → Step 3 fails
   → Return: 403 Forbidden
   → Message: "requires permission: customers.read"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
