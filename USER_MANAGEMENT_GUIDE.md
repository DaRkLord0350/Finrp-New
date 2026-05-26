# User Management Implementation Guide

This document outlines the remaining work needed to complete the enterprise RBAC system.

## Phase 9: User Invitation System

### API Endpoint: POST /api/users/invite
**File to create**: `app/api/users/invite/route.ts` OR refactor existing structure

```typescript
import { withAuth } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (req: Request, { organizationId, user }) => {
    const { email, role } = await req.json();
    
    // Validate email and role
    // Check if user already exists
    // Create pending user record
    // Return created user
  },
  "users.write"
);
```

**Workflow**:
1. Admin provides email and role
2. System creates pending user record in DB
3. In production: Send Clerk invite link via email
4. User signs up with Clerk
5. On Clerk webhook: Activate pending user record
6. User gains access with assigned role

### Frontend: Invite Form Component
**File to create**: `components/InviteUserForm.tsx`

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      
      if (res.ok) {
        // Show success
        setEmail("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        placeholder="user@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option>ADMIN</option>
        <option>CA</option>
        <option>ACCOUNTANT</option>
        <option>STAFF</option>
        <option>VIEWER</option>
      </select>
      <Button type="submit" disabled={loading}>
        {loading ? "Inviting..." : "Invite"}
      </Button>
    </form>
  );
}
```

## Phase 10: User Management Page

### Page: /settings/users
**File to create**: `app/(dashboard)/settings/users/page.tsx`

Features:
- ✅ List all organization users
- ✅ Show user email, role, status (active/pending)
- ✅ Show join date
- ✅ Edit role (via modal or separate page)
- ✅ Remove/deactivate users
- ✅ Invite button (protected with Can component)
- ✅ Page permission guard: requirePagePermission("users.read")

### Sub-page: /settings/users/[id]/edit
**File to create**: `app/(dashboard)/settings/users/[id]/edit/page.tsx`

Features:
- Change user role
- Deactivate/reactivate user
- Go back to users list

### API: PUT /api/users/[id]
**File to create**: `app/api/users/[id]/route.ts`

```typescript
export const PUT = withAuth(async (req, { organizationId }) => {
  const { role, isActive } = await req.json();
  
  // Update user role/status
  // Verify user belongs to same organization
}, "users.write");
```

### API: DELETE /api/users/[id]
```typescript
export const DELETE = withAuth(async (req, { organizationId, user }) => {
  // Prevent deleting yourself
  // Prevent deleting last admin
  // Delete user from organization
}, "users.write");
```

## Phase 11: Testing

Manual testing checklist:
- [ ] ADMIN user can access user management page
- [ ] CA user cannot access user management page (gets redirected to /forbidden)
- [ ] Can invite new user with form
- [ ] Invited user appears in list as "Pending"
- [ ] Can edit user role
- [ ] Can deactivate user
- [ ] Cannot delete last admin
- [ ] Cannot delete yourself
- [ ] API returns 403 for users without permission

E2E test scenarios:
- [ ] ADMIN invites CA, CA appears in list, can edit role
- [ ] STAFF cannot invite users, gets 403 on API call
- [ ] Sidebar shows/hides settings based on permission

## Phase 12: Security Audit

Checklist:
- [ ] All user management APIs protected with withAuth
- [ ] organizationId verified on all queries (users can't access other org's users)
- [ ] Cannot modify SUPER_ADMIN users
- [ ] Cannot give yourself higher privileges
- [ ] All user-modifying actions logged in auditLogs table
- [ ] Clerk webhook properly handles user activation

## Database Schema Notes

Current User model supports:
- ✅ role field (ADMIN, CA, ACCOUNTANT, STAFF, VIEWER)
- ✅ organizationId (multi-tenant isolation)
- ✅ isActive flag (pending user support)
- ✅ clerkId (can be pending-* temporarily)

Consider adding:
- `lastLoginAt` — Already exists
- `lastModifiedBy` — For audit trail
- `deactivatedAt` — Soft delete timestamp

## Migration Path

1. Create `/api/users/list` endpoint (GET) — Lists users in org
2. Create `/api/users/invite` endpoint (POST) — Invite user
3. Create `/api/users/[id]/update` endpoint (PUT) — Change role
4. Create `/api/users/[id]/remove` endpoint (DELETE) — Remove user
5. Create `InviteUserForm` component
6. Create `/settings/users` page with user list
7. Create `/settings/users/[id]/edit` page for editing
8. Update Clerk webhook to activate pending users
9. Add audit logging for user modifications
10. Test with different roles

## Future Enhancements

- Team/Department support
- Role customization (dynamic RBAC tables)
- User activity logging
- Bulk user import (CSV)
- SSO/SAML integration
- User groups/teams
- Granular action logging
- API token management for users
