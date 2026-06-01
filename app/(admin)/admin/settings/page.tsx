import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "ADMIN") redirect("/dashboard");

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Platform Settings</h1>
        <p className="section-subtitle">Global configuration and system preferences</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {[
          {
            title: "System Configuration",
            description: "Manage global platform settings, feature flags, and defaults.",
            items: ["Feature flags", "Default plans", "Rate limits", "API configuration"],
          },
          {
            title: "Security Settings",
            description: "Configure authentication, session management, and access policies.",
            items: ["Session timeout", "IP allowlist", "2FA requirements", "Audit logging"],
          },
          {
            title: "Notification Settings",
            description: "Configure platform-wide notification templates and delivery rules.",
            items: ["Email templates", "SMS settings", "Webhook endpoints", "Alert thresholds"],
          },
          {
            title: "Billing & Plans",
            description: "Manage subscription plans, pricing, and billing configurations.",
            items: ["Plan limits", "Feature matrix", "Trial settings", "Payment gateway"],
          },
        ].map((section) => (
          <div key={section.title} className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Settings size={16} color="#6366f1" />
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                {section.title}
              </h3>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              {section.description}
            </p>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {section.items.map((item) => (
                <li
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "var(--bg-elevated)",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    cursor: "not-allowed",
                    opacity: 0.7,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#6366f1",
                      flexShrink: 0,
                    }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
