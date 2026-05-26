# FinRP RBAC Testing & Validation Guide

## Testing Strategy

This guide covers how to test the enterprise RBAC system implementation.

---

## 1. Manual Testing (Pre-Deployment)

### Test Case 1: Authenticate as ADMIN
**Setup**: Create a test user with ADMIN role
**Steps**:
1. Log in with admin@test.com
2. Verify you see: Dashboard, CRM, Billing, Finance, ERP, Compliance, AI Advisor, Settings
3. Try accessing `/api/customers` — Should get 200 OK
4. Try accessing `/finance` — Should render page
5. Try accessing Can component buttons — All should show

**Expected**: Full access to all modules and APIs

---

### Test Case 2: Authenticate as CA (Chartered Accountant)
**Setup**: Create user with CA role
**Steps**:
1. Log in with ca@test.com
2. Verify sidebar shows: Dashboard, Finance, Compliance, AI Advisor
3. Verify sidebar HIDES: CRM, Billing, ERP, Settings
4. Try `/api/customers` — Should get **403 Forbidden**
5. Try `/api/compliance` — Should get **200 OK**
6. Try `/customers` page — Should redirect to **/unauthorized**
7. Try `/compliance` page — Should render
8. Try Can component for "customers.write" — Should NOT render

**Expected**: Limited access to finance/compliance only

---

### Test Case 3: Authenticate as STAFF
**Setup**: Create user with STAFF role
**Steps**:
1. Log in with staff@test.com
2. Verify sidebar shows: Dashboard, CRM
3. Verify sidebar HIDES: Billing, Finance, ERP, Compliance, Settings
4. Try `/api/customers` — Should get **200 OK**
5. Try `/api/invoices` — Should get **403 Forbidden** (no invoices.read)
6. Try Can component for "inventory.write" — SHOULD render (STAFF has it)
7. Try Can component for "finance.write" — Should NOT render

**Expected**: Operational access only (customers, inventory, ERP read)

---

### Test Case 4: Authenticate as VIEWER
**Setup**: Create user with VIEWER role
**Steps**:
1. Log in with viewer@test.com
2. Verify sidebar shows: Dashboard only (maybe Analytics)
3. Try `/api/customers` — Should get **200 OK** (has customers.read)
4. Try POST `/api/customers` — Should get **403 Forbidden** (no customers.write)
5. Try Can component for "invoices.write" — Should NOT render
6. Try Can component for "dashboard.read" — SHOULD render

**Expected**: Read-only access to reports and analytics

---

### Test Case 5: Organization Isolation
**Setup**: Have 2 different test organizations
**Steps**:
1. Sign in as User A in Organization 1
2. Get organizationId1 from getCurrentUser()
3. Create a customer in Org 1
4. Sign out, sign in as User B in Organization 2
5. Try `GET /api/customers` — Should only see Org 2 customers
6. Try to access Organization 1's customers via direct ID — Should fail

**Expected**: Users only see their organization's data

---

## 2. API Testing (cURL/Postman)

### Test Endpoint: GET /api/customers

**Unauthenticated**:
```bash
curl -X GET http://localhost:3000/api/customers
# Expected: 401 Unauthorized
```

**Authenticated (STAFF with customers.read)**:
```bash
curl -X GET http://localhost:3000/api/customers \
  -H "Authorization: Bearer <jwt_token>"
# Expected: 200 OK + list of customers
```

**Authenticated (VIEWER without customers.read)**:
```bash
curl -X GET http://localhost:3000/api/customers \
  -H "Authorization: Bearer <viewer_jwt>"
# Expected: 403 Forbidden
```

### Test Endpoint: POST /api/invoices (Write Operation)

**ADMIN (has invoices.write)**:
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust_123",
    "dueDate": "2026-06-30",
    "items": [{"description": "Service", "quantity": 1, "unitPrice": 100}],
    "taxRate": 18
  }'
# Expected: 201 Created
```

**STAFF (no invoices.write)**:
```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Authorization: Bearer <staff_jwt>" \
  -H "Content-Type: application/json" \
  -d '{...}'
# Expected: 403 Forbidden
```

---

## 3. Page-Level Testing

### Test Case: Page Guard Redirects

**Access Finance Page as STAFF**:
```
1. Log in as STAFF user
2. Navigate to /finance
3. Expected: Redirect to /forbidden
4. Page should show "Access Denied" message
```

**Access Finance Page as CA**:
```
1. Log in as CA user
2. Navigate to /finance
3. Expected: Page renders successfully
4. Finance module displays
```

**Access Settings as STAFF**:
```
1. Log in as STAFF user
2. Navigate to /settings
3. Expected: Redirect to /forbidden (no settings.read)
4. Cannot manage organization settings
```

---

## 4. UI Component Testing

### Test Case: Can Component Visibility

**Button Visibility**:
```typescript
// In invoice actions component
<Can permission="invoices.write">
  <Button>Edit Invoice</Button> {/* Should show for ADMIN, CA, ACCOUNTANT */}
</Can>

<Can permission="compliance.approve">
  <Button>Approve</Button> {/* Should show for ADMIN, CA only */}
</Can>

<Can permission="users.delete">
  <Button>Delete User</Button> {/* Should show for ADMIN only */}
</Can>
```

**Test Steps**:
1. Log in as ADMIN → All buttons visible
2. Log in as CA → Only compliance.approve and finance buttons visible
3. Log in as STAFF → Only operational buttons visible
4. Log in as VIEWER → No buttons visible (read-only)

### Test Case: Sidebar Filtering

**Sidebar Item Visibility**:
```
ADMIN:    [Dashboard, CRM, Billing, Finance, ERP, Compliance, AI Advisor, Settings]
CA:       [Dashboard, Finance, Compliance, AI Advisor] 
ACCOUNTANT: [Dashboard, Finance, Compliance, AI Advisor]
STAFF:    [Dashboard, CRM]
VIEWER:   [Dashboard]
```

**Test**:
1. Log in with each role
2. Check sidebar items match expected list
3. Verify hidden items don't appear (no CSS hack visibility)
4. Test on mobile/tablet view (sidebar toggle)

---

## 5. Automated Tests (Optional)

### Jest Test Example: Permission Checking

```typescript
// lib/auth/__tests__/access.test.ts
import { hasPermission } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";

jest.mock("@/lib/auth/session");

describe("hasPermission", () => {
  it("should allow ADMIN all permissions", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({
      role: "ADMIN",
      organizationId: "org_1",
    });

    const result = await hasPermission("customers.delete");
    expect(result).toBe(true);
  });

  it("should deny VIEWER write permissions", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({
      role: "VIEWER",
      organizationId: "org_1",
    });

    const result = await hasPermission("customers.write");
    expect(result).toBe(false);
  });

  it("should allow CA compliance permissions", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({
      role: "CA",
      organizationId: "org_1",
    });

    const result = await hasPermission("compliance.approve");
    expect(result).toBe(true);
  });
});
```

### Playwright E2E Test Example

```typescript
// e2e/rbac.spec.ts
import { test, expect } from "@playwright/test";

test.describe("RBAC - Role-Based Access Control", () => {
  test("ADMIN can access all modules", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "password");
    await page.click("button:has-text('Sign In')");

    // Wait for dashboard
    await page.waitForURL("/dashboard");

    // Check sidebar
    const sidebar = page.locator(".sidebar");
    expect(sidebar).toContainText("Dashboard");
    expect(sidebar).toContainText("CRM");
    expect(sidebar).toContainText("Finance");
    expect(sidebar).toContainText("Compliance");
    expect(sidebar).toContainText("Settings");
  });

  test("STAFF cannot access Finance", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[name="email"]', "staff@test.com");
    await page.fill('input[name="password"]', "password");
    await page.click("button:has-text('Sign In')");

    // Try to navigate to Finance
    await page.goto("/finance");

    // Should redirect to forbidden
    await expect(page).toHaveURL("/forbidden");
    expect(page.locator("h1")).toContainText("Access Denied");
  });

  test("CA can access Compliance", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[name="email"]', "ca@test.com");
    await page.fill('input[name="password"]', "password");
    await page.click("button:has-text('Sign In')");

    // Navigate to Compliance
    await page.click("a:has-text('Compliance')");

    // Should load compliance page
    await page.waitForURL("/compliance");
    expect(page.locator("h1")).toContainText("Compliance");
  });

  test("Cannot access other organization data", async ({ page }) => {
    // Create two test orgs with API
    const org1 = await createTestOrg("org1@test.com");
    const org2 = await createTestOrg("org2@test.com");

    // Sign in as org1 user
    await signIn(page, org1.email, org1.password);

    // Create customer in org1
    const customer = await createCustomer(org1.id, "John Doe");

    // Sign in as org2 user
    await signOut(page);
    await signIn(page, org2.email, org2.password);

    // Try to access org1 customer via API
    const response = await page.request.get(
      `/api/customers?id=${customer.id}`
    );

    // Should return empty or 403
    expect(response.status()).toBe(403);
  });
});
```

---

## 6. Security Audit Checklist

- [ ] All API routes use `withAuth` middleware
- [ ] All `withAuth` calls include permission parameter
- [ ] All protected pages call `requirePagePermission` or similar
- [ ] No hardcoded permissions in frontend
- [ ] organizationId is filtered in ALL database queries
- [ ] Cannot escalate own permissions
- [ ] Cannot access other organization's data
- [ ] Cannot view pending users without permissions
- [ ] API returns proper status codes (401, 403)
- [ ] Page guards use `redirect()` not try-catch
- [ ] No permission data leaked in error messages
- [ ] Sidebar doesn't show items user can't access
- [ ] Can component is purely UI (no security)
- [ ] User roles cannot be modified via frontend
- [ ] Audit logs created for sensitive actions

---

## 7. Performance Testing

### Test: Permission Checking Overhead

```typescript
// Measure permission check speed
const start = performance.now();

for (let i = 0; i < 1000; i++) {
  await hasPermission("invoices.read");
}

const duration = performance.now() - start;
console.log(`1000 permission checks: ${duration}ms`);
// Expected: < 100ms (permission matrix is in-memory)
```

### Test: withAuth Middleware Performance

```typescript
// Check API response time with withAuth
// Should be < 50ms overhead (single DB query for user)
```

---

## 8. Regression Testing

After deployment, regularly test:

1. **Permission Matrix**: Run through all 6 roles, verify access
2. **Organization Isolation**: Verify data boundaries
3. **API Endpoints**: Test all 30+ routes with different roles
4. **Page Access**: Test key pages with different roles
5. **Sidebar Rendering**: Verify correct items show per role
6. **Error Handling**: Test error pages and messages

---

## 9. Deployment Validation

Before going live:

```bash
# 1. Verify all routes use withAuth
grep -r "export const \(GET\|POST\|PUT\|DELETE\)" app/api \
  | grep -v "withAuth" \
  | grep -v "webhooks" \
  | grep -v ".test"
# Should return empty (all protected)

# 2. Verify permission matrix is complete
# Check that all permissions used in routes are defined in permissions.ts

# 3. Run permission tests
npm test -- lib/auth/__tests__

# 4. Run E2E tests with all roles
npx playwright test

# 5. Check organization isolation
# Run manual test with 2 organizations
```

---

## 10. Issues & Troubleshooting

### Issue: User sees blank sidebar
**Cause**: Sidebar failed to load visible items  
**Fix**: Check browser console for errors, verify user has valid permissions

### Issue: API returns 403 but user should have access
**Cause**: Permission not in rolePermissions matrix  
**Fix**: Add permission to user's role in lib/auth/permissions.ts

### Issue: Page redirects to /forbidden correctly but wrong message
**Cause**: Error page text doesn't match redirect reason  
**Fix**: Update /forbidden page with contextual message

### Issue: Sidebar loads but filters don't work
**Cause**: Sidebar component not awaiting getVisibleSidebarItems  
**Fix**: Verify useEffect properly calls async function

### Issue: Can component always shows content
**Cause**: Permission checking not working in client component  
**Fix**: Ensure Can component awaits hasPermission in useEffect

---

## Summary

The RBAC system is comprehensive and multi-layered:

✅ **4 Protection Layers** — Each with own test suite  
✅ **30+ API Routes Protected** — All require valid permissions  
✅ **6 Role Types** — All with unique permission sets  
✅ **UI Filtering** — Sidebar and component visibility  
✅ **Organization Isolation** — Data boundaries enforced  

**Time to Full Testing**: 1-2 hours manual, 1-2 hours automation
