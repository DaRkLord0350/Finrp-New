// ============================================================
// /firm/billing — CA firm billing & upgrades
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getBillingSummary } from "@/lib/services/billing.service";
import { BillingPanel } from "@/components/billing/BillingPanel";

export const metadata = { title: "Plan & Billing — FinRP Firm" };

export default async function FirmBillingPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN" && user.userRole !== "ADMIN") redirect("/dashboard");

  const summary = await getBillingSummary(user.organizationId);

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Plan &amp; Billing</h1>
        <p className="section-subtitle">Manage your firm&apos;s subscription, payments, and invoices</p>
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
