// ============================================================
// /settings/billing — business billing & upgrades
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getBillingSummary } from "@/lib/services/billing.service";
import { BillingPanel } from "@/components/billing/BillingPanel";

export const metadata = { title: "Billing — FinRP" };

export default async function BillingSettingsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");

  const summary = await getBillingSummary(user.organizationId);

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Billing</h1>
        <p className="section-subtitle">Manage your plan, payments, and invoices</p>
      </div>
      <BillingPanel
        entitlements={summary.entitlements}
        planName={summary.planName}
        price={summary.price}
        status={summary.status}
        renewalDate={summary.renewalDate}
        features={summary.features}
        usage={summary.usage}
        plans={summary.catalog}
        history={summary.history}
        connectedToCA={summary.connectedToCA}
        caName={summary.caName}
      />
    </div>
  );
}
