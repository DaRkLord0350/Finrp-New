// ============================================================
// /firm/connections — CA ↔ Business pricing relationships
//
// Invite businesses to connect (they get Connected free), see linked
// clients + their plan, and unlink. Guarded by the firm layout
// (CA_FIRM_ADMIN). Interactive logic lives in ConnectionsManager.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ConnectionsManager } from "@/components/firm/ConnectionsManager";

export const metadata = { title: "Client Connections — FinRP Firm" };

export default async function FirmConnectionsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN" && user.userRole !== "ADMIN") redirect("/dashboard");

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Client Connections</h1>
        <p className="section-subtitle">
          Invite businesses to connect with your firm. Connected clients get the FinRP{" "}
          <strong>Connected</strong> plan for free.
        </p>
      </div>
      <ConnectionsManager />
    </div>
  );
}
