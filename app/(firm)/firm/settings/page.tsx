import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Settings, Building2, Mail, Phone } from "lucide-react";

export default async function FirmSettingsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    include: { businessProfile: true },
  });

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Firm Settings</h1>
        <p className="section-subtitle">Manage your firm profile and preferences</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 800 }}>
        {/* Firm Profile */}
        <div className="section-card" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <Building2 size={16} color="#10b981" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Firm Profile</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "Organization Name", value: org?.name },
              { label: "Slug", value: org?.slug },
              { label: "Plan", value: org?.plan },
              { label: "Business Name", value: org?.businessProfile?.businessName },
              { label: "GSTIN", value: org?.businessProfile?.gstin },
              { label: "PAN", value: org?.businessProfile?.pan },
              { label: "Contact Email", value: org?.businessProfile?.contactEmail },
              { label: "Phone", value: org?.businessProfile?.phone },
            ].map((field) => (
              <div key={field.label}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {field.label}
                </label>
                <p style={{ fontSize: 13, color: field.value ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {field.value ?? "Not set"}
                </p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <a
              href="/settings/organization"
              className="btn-ghost"
              style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Settings size={14} />
              Edit Organization Profile
            </a>
          </div>
        </div>

        {/* Account Info */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Settings size={16} color="#6366f1" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Your Account</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Name</p>
              <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{user.name ?? "—"}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Email</p>
              <p style={{ fontSize: 13, color: "var(--text-primary)" }}>{user.email}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Role</p>
              <span className="badge" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", borderColor: "rgba(16,185,129,0.3)" }}>
                CA Firm Admin
              </span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Settings size={16} color="#0ea5e9" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Quick Links</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Team Management", href: "/firm/team" },
              { label: "Customer Assignments", href: "/firm/assignments" },
              { label: "View Reports", href: "/firm/reports" },
              { label: "Organization Settings", href: "/settings/organization" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  display: "block",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "var(--bg-elevated)",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  transition: "background 0.15s ease",
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
