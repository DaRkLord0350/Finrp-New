// ============================================================
// CA Portal — Profile
// The CA's own profile (name, phone, designation, specialization)
// plus read-only firm context and portfolio stats.
// ============================================================

import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const [firm, assignedCount, openTasks] = await Promise.all([
    user.firmId
      ? prisma.firm.findUnique({ where: { id: user.firmId }, select: { name: true, registrationNumber: true } })
      : Promise.resolve(null),
    prisma.customerAssignment.count({ where: { caId: user.id, isActive: true } }),
    prisma.firmTask.count({ where: { assignedCaId: user.id, status: { not: "COMPLETED" } } }),
  ]);

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Profile</h1>
        <p className="section-subtitle">Your details and firm context.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
        <ProfileForm
          initial={{
            name: user.name ?? "",
            phone: user.phone ?? "",
            designation: user.designation ?? "",
            specialization: user.specialization ?? "",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="section-card">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Firm</h3>
            <Row label="Firm" value={firm?.name ?? "—"} />
            <Row label="ICAI Reg." value={firm?.registrationNumber ?? "—"} />
            <Row label="Firm Role" value={user.firmRole ?? "—"} />
            <Row label="Email" value={user.email} />
          </div>
          <div className="section-card">
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Portfolio</h3>
            <div style={{ display: "flex", gap: 12 }}>
              <Stat label="Clients" value={assignedCount} color="#6366f1" />
              <Stat label="Open Tasks" value={openTasks} color="#f59e0b" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "10px 0", background: "var(--bg-elevated)", borderRadius: 10 }}>
      <p style={{ fontSize: 24, fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}
