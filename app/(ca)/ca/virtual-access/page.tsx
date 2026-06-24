// ============================================================
// CA Portal — Virtual Access
// Workspace context-switching (NO password sharing). Each assigned
// client gets an access tier (CAWorkspacePermission) that maps onto
// the existing ClientAssignment/cookie impersonation system. "Open
// Workspace" enters the client's org; a banner then shows
// "Viewing As CA for [Customer]".
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { KeyRound, ShieldCheck } from "lucide-react";
import { getAssignedCustomers } from "@/lib/ca/portal";
import { tierFromClientPermissions } from "@/lib/ca/permissions";
import VirtualAccessCard from "./VirtualAccessCard";
import type { CAWorkspaceAccessTier } from "@prisma/client";

export default async function VirtualAccessPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const clients = await getAssignedCustomers(user.id);
  const customerIds = clients.map((c) => c.customer.id);
  const orgIds = clients.map((c) => c.organizationId).filter(Boolean) as string[];

  const [perms, assignments] = await Promise.all([
    customerIds.length
      ? prisma.cAWorkspacePermission.findMany({ where: { caUserId: user.id, customerId: { in: customerIds } } })
      : Promise.resolve([]),
    orgIds.length
      ? prisma.clientAssignment.findMany({ where: { caUserId: user.id, organizationId: { in: orgIds }, isActive: true }, select: { organizationId: true, permissions: true } })
      : Promise.resolve([]),
  ]);

  const permByCustomer = new Map(perms.map((p) => [p.customerId, p.tier]));
  const tierByOrg = new Map(
    assignments.map((a) => [a.organizationId, tierFromClientPermissions(a.permissions)])
  );

  const rows = clients.map((c) => {
    const tier: CAWorkspaceAccessTier | null =
      permByCustomer.get(c.customer.id) ??
      (c.organizationId ? tierByOrg.get(c.organizationId) ?? null : null);
    return {
      customerId: c.customer.id,
      name: c.customer.name,
      company: c.customer.company,
      organizationId: c.organizationId,
      currentTier: tier,
    };
  });

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 8 }}>
        <h1 className="section-title">Virtual Access</h1>
        <p className="section-subtitle">
          Securely operate inside a client&apos;s workspace on their behalf — no credentials shared.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: "rgba(14,165,233,0.08)",
          border: "1px solid rgba(14,165,233,0.2)",
          borderRadius: 10,
          marginBottom: 24,
        }}
      >
        <ShieldCheck size={18} color="#0ea5e9" />
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
          Access is governed by a tier you assign per client. Every action inside a client workspace is
          audit-logged, and the session is bound to your account with a signed, expiring token.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <KeyRound size={44} color="var(--text-muted)" />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No clients to access</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Assigned clients appear here once allocated to you.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))", gap: 16 }}>
          {rows.map((r) => (
            <VirtualAccessCard key={r.customerId} {...r} />
          ))}
        </div>
      )}
    </div>
  );
}
