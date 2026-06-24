"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User as UserIcon,
  ShieldCheck,
  Send,
  Check,
  ArrowLeft,
  ArrowRight,
  Mail,
} from "lucide-react";
import {
  FIRM_MEMBER_ROLES,
  FIRM_ROLE_LABELS,
  FIRM_PERMISSIONS,
  FIRM_PERMISSION_LABELS,
  FIRM_PERMISSION_DESCRIPTIONS,
  EMAIL_REGEX,
} from "@/lib/team/constants";
import type { FirmMemberRole, FirmPermission } from "@prisma/client";

interface ManagerOption {
  id: string;
  name: string;
  role: string | null;
}

const STEPS = [
  { n: 1, label: "Basic Information", icon: UserIcon },
  { n: 2, label: "Permissions", icon: ShieldCheck },
  { n: 3, label: "Invite", icon: Send },
];

export function AddCaWizard({ managers }: { managers: ManagerOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<FirmMemberRole>("CA");
  const [managerId, setManagerId] = useState("");
  const [permissions, setPermissions] = useState<FirmPermission[]>(["MANAGE_CUSTOMERS"]);

  function togglePerm(p: FirmPermission) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  const step1Valid = name.trim().length > 0 && EMAIL_REGEX.test(email.trim());

  function next() {
    if (step === 1 && !step1Valid) {
      toast.error("Enter a name and a valid email");
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/firm/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          firmRole: role,
          firmPermissions: permissions,
          managerId: managerId || null,
          sendInvite: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to send invitation");
      // The seat is created either way, but the email may have failed to
      // dispatch — tell the truth so the admin can resend if needed.
      if (data.emailSent === false) {
        toast.warning(
          `Seat created, but the invitation email could not be sent${
            data.emailError ? `: ${data.emailError}` : ""
          }. You can resend it from Onboarding.`
        );
      } else {
        toast.success(`Invitation sent to ${email.trim()}`);
      }
      router.push("/firm/onboarding");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invitation");
      setSubmitting(false);
    }
  }

  const managerName = managers.find((m) => m.id === managerId)?.name ?? "None";

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Add CA</h1>
        <p className="section-subtitle">Onboard a new team member with a guided invitation.</p>
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = step === s.n;
          const done = step > s.n;
          return (
            <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "0 0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: done ? "#10b981" : active ? "#6366f1" : "var(--bg-elevated)",
                    color: done || active ? "white" : "var(--text-muted)",
                    border: done || active ? "none" : "1px solid var(--border)",
                    flexShrink: 0,
                  }}
                >
                  {done ? <Check size={18} /> : <Icon size={17} />}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--text-primary)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: step > s.n ? "#10b981" : "var(--border)", margin: "0 12px" }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="section-card">
        {/* Step 1 */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Full Name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" style={inputStyle} />
            </Field>
            <Field label="Email" required>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rahul@example.com" style={inputStyle} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9999999999" style={inputStyle} />
              </Field>
              <Field label="Role" required>
                <select value={role} onChange={(e) => setRole(e.target.value as FirmMemberRole)} style={inputStyle}>
                  {FIRM_MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>{FIRM_ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Choose what this member can do across the firm.</p>
            {FIRM_PERMISSIONS.map((p) => {
              const on = permissions.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => togglePerm(p)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    background: on ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)",
                    border: `1px solid ${on ? "#6366f1" : "var(--border)"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{FIRM_PERMISSION_LABELS[p]}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{FIRM_PERMISSION_DESCRIPTIONS[p]}</p>
                  </div>
                  <span
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 99,
                      background: on ? "#6366f1" : "var(--border)",
                      position: "relative",
                      transition: "background 0.15s",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.15s" }} />
                  </span>
                </button>
              );
            })}

            <Field label="Reporting Manager (optional)">
              <select value={managerId} onChange={(e) => setManagerId(e.target.value)} style={inputStyle}>
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px", background: "var(--bg-elevated)", borderRadius: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(99,102,241,0.15)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>
                {(name || email).charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{name || "—"}</p>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{email} · {FIRM_ROLE_LABELS[role]}</p>
              </div>
            </div>

            <ReviewRow label="Phone" value={phone || "—"} />
            <ReviewRow label="Reporting Manager" value={managerName} />
            <ReviewRow
              label="Permissions"
              value={permissions.length ? permissions.map((p) => FIRM_PERMISSION_LABELS[p]).join(", ") : "None"}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10 }}>
              <Mail size={16} color="#10b981" />
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                An invitation email with a secure sign-up link will be sent to <strong>{email}</strong>. Their account and CA profile are created when they accept.
              </p>
            </div>
          </div>
        )}

        {/* Nav */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
          <button onClick={back} disabled={step === 1} style={{ ...navBtn(false), opacity: step === 1 ? 0.4 : 1, cursor: step === 1 ? "not-allowed" : "pointer" }}>
            <ArrowLeft size={15} /> Back
          </button>
          {step < 3 ? (
            <button onClick={next} style={navBtn(true)}>
              Next <ArrowRight size={15} />
            </button>
          ) : (
            <button onClick={submit} disabled={submitting} style={{ ...navBtn(true), opacity: submitting ? 0.6 : 1 }}>
              <Send size={15} /> {submitting ? "Sending…" : "Send Invitation"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}
        {required && <span style={{ color: "#ef4444" }}> *</span>}
      </span>
      {children}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 14,
};

function navBtn(primary: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 18px",
    background: primary ? "#6366f1" : "var(--bg-elevated)",
    color: primary ? "white" : "var(--text-secondary)",
    border: primary ? "none" : "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };
}
