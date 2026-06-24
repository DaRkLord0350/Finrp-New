import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { resolvePortalClient } from "@/lib/client-portal/context";
import { listFilingApprovals } from "@/lib/client-portal/queries";
import { FilingApprovalsClient } from "@/components/portal/FilingApprovalsClient";
import { serializeFiling } from "@/lib/client-portal/serialize";

export default async function CustomerApprovalsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");

  const ctx = await resolvePortalClient({
    id: user.id,
    email: user.email,
    organizationId: user.organizationId,
    firmId: user.firmId,
    userRole: user.userRole,
  });

  if (!ctx) {
    return (
      <div className="page-container animate-fade-in">
        <div style={{ marginBottom: 24 }}>
          <h1 className="section-title">Approvals</h1>
          <p className="section-subtitle">Filings prepared by your CA</p>
        </div>
        <div className="section-card">
          <div className="empty-state">
            <BadgeCheck size={44} color="var(--text-muted)" />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>No CA linked yet</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 340 }}>
              Once a CA firm connects with you, filings that need your approval will appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const rows = await listFilingApprovals(ctx.organizationId, { customerId: ctx.customerId });
  const filings = rows.map(serializeFiling);

  return <FilingApprovalsClient filings={filings} mode="customer" />;
}
