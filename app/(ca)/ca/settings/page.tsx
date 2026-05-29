import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Settings, User, Bell, Shield, KeyRound } from "lucide-react";

export default async function CASettingsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Settings</h1>
        <p className="section-subtitle">Manage your CA practice preferences</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24 }}>
        {/* Sidebar tabs */}
        <div className="section-card" style={{ padding: 12, height: "fit-content" }}>
          {[
            { label: "Profile", icon: User },
            { label: "Notifications", icon: Bell },
            { label: "Security", icon: Shield },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="sidebar-nav-item"
                style={{ marginBottom: 2, background: i === 0 ? "rgba(99,102,241,0.1)" : undefined, color: i === 0 ? "var(--brand-400)" : undefined }}
              >
                <Icon size={16} strokeWidth={1.75} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Profile */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <User size={16} color="var(--brand-400)" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                CA Profile
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="label">Full Name</label>
                <input type="text" className="input" defaultValue={user.name ?? ""} readOnly />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" defaultValue={user.email} readOnly />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="tel" className="input" defaultValue={user.phone ?? ""} readOnly />
              </div>
              <div>
                <label className="label">Role</label>
                <input type="text" className="input" defaultValue="Chartered Accountant (CA)" readOnly />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label">Designation</label>
                <input type="text" className="input" defaultValue={user.designation ?? ""} readOnly />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
              Profile information is managed via the Clerk authentication portal.
            </p>
          </div>

          {/* Notification preferences */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Bell size={16} color="var(--brand-400)" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Notification Preferences
              </h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "New document uploaded by client", desc: "Get notified when a client uploads a document" },
                { label: "Deadline approaching (7 days)", desc: "Reminder 7 days before a filing deadline" },
                { label: "Deadline approaching (1 day)", desc: "Reminder 1 day before a filing deadline" },
                { label: "Document resubmission", desc: "When a client resubmits a rejected document" },
                { label: "New client assigned", desc: "When an admin assigns a new client to you" },
                { label: "Compliance overdue", desc: "When a compliance filing becomes overdue" },
              ].map((pref) => (
                <div
                  key={pref.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{pref.label}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{pref.desc}</p>
                  </div>
                  <input type="checkbox" defaultChecked style={{ width: 16, height: 16, accentColor: "var(--brand-500)" }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn-brand" style={{ opacity: 0.5, cursor: "not-allowed" }} disabled>
                Save Preferences
              </button>
            </div>
          </div>

          {/* Security */}
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Shield size={16} color="var(--brand-400)" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Security
              </h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Security settings including password, 2FA, and session management are handled via your Clerk profile.
            </p>
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <KeyRound size={16} color="var(--brand-400)" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                    Account managed via Clerk
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Role: CA · Platform: FinRP
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
