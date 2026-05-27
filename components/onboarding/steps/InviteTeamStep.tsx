"use client";

// ============================================================
// Step 4 — Invite Team
// ============================================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowRight, UserPlus, Trash2, Mail, ChevronRight } from "lucide-react";
import { singleInviteSchema, type SingleInviteInput } from "@/validators/onboarding";
import type { OnboardingInvite, InviteRole } from "@/types/onboarding";

interface InviteTeamStepProps {
  initialInvites: OnboardingInvite[];
  onNext: (invites: OnboardingInvite[]) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

const ROLE_OPTIONS: { value: InviteRole; label: string; description: string }[] = [
  { value: "ADMIN", label: "Admin", description: "Full access except billing" },
  { value: "MANAGER", label: "Manager", description: "Team and operations management" },
  { value: "ACCOUNTANT", label: "CA / Accountant", description: "Finance and accounting access" },
  { value: "STAFF", label: "Staff", description: "Read + limited write access" },
  { value: "VIEWER", label: "Viewer", description: "Read-only access" },
];

const ROLE_COLORS: Record<InviteRole, string> = {
  ADMIN: "#6366f1",
  MANAGER: "#3b82f6",
  ACCOUNTANT: "#10b981",
  STAFF: "#f59e0b",
  VIEWER: "#6b7280",
};

export function InviteTeamStep({
  initialInvites,
  onNext,
  onBack,
  isLoading,
}: InviteTeamStepProps) {
  const [invites, setInvites] = useState<OnboardingInvite[]>(initialInvites);
  const [addError, setAddError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SingleInviteInput>({
    resolver: zodResolver(singleInviteSchema),
    defaultValues: { role: "STAFF" },
  });

  function addInvite(data: SingleInviteInput) {
    if (invites.some((i) => i.email.toLowerCase() === data.email.toLowerCase())) {
      setAddError("This email has already been invited");
      return;
    }
    if (invites.length >= 10) {
      setAddError("You can invite up to 10 members during onboarding");
      return;
    }
    setInvites((prev) => [
      ...prev,
      { email: data.email, role: data.role as InviteRole },
    ]);
    setAddError(null);
    reset({ role: "STAFF" });
  }

  function removeInvite(email: string) {
    setInvites((prev) => prev.filter((i) => i.email !== email));
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
        Invite team members to collaborate. They&apos;ll receive an email to join your workspace.
      </p>

      {/* Add invite form */}
      <form onSubmit={handleSubmit(addInvite)}>
        <div
          style={{
            padding: "16px",
            background: "var(--bg-elevated)",
            borderRadius: 12,
            border: "1px solid var(--border)",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 10 }}>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={14}
                  color="var(--text-muted)"
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  {...register("email")}
                  placeholder="colleague@company.com"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    padding: "9px 12px 9px 34px",
                    fontSize: 13,
                    width: "100%",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {errors.email && (
                <span style={{ color: "#ef4444", fontSize: 11, marginTop: 3, display: "block" }}>
                  {errors.email.message}
                </span>
              )}
            </div>
            <div>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Role
              </label>
              <select
                {...register("role")}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  padding: "9px 12px",
                  fontSize: 13,
                  outline: "none",
                  cursor: "pointer",
                  minWidth: 140,
                }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {addError && (
            <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{addError}</p>
          )}

          <button
            type="submit"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 8,
              color: "var(--brand-400)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <UserPlus size={14} />
            Add to List
          </button>
        </div>
      </form>

      {/* Invite list */}
      {invites.length > 0 && (
        <div
          style={{
            marginBottom: 20,
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {invites.map((invite, idx) => {
            const roleColor = ROLE_COLORS[invite.role] ?? "#6b7280";
            const roleLabel =
              ROLE_OPTIONS.find((r) => r.value === invite.role)?.label ?? invite.role;
            return (
              <div
                key={invite.email}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: idx % 2 === 0 ? "var(--bg-elevated)" : "var(--bg-surface)",
                  borderBottom:
                    idx < invites.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: `${roleColor}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    color: roleColor,
                  }}
                >
                  {invite.email[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {invite.email}
                  </p>
                  <p style={{ fontSize: 11, color: roleColor, fontWeight: 600 }}>
                    {roleLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeInvite(invite.email)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 4,
                    borderRadius: 6,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {invites.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            color: "var(--text-muted)",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          No invites yet. Add team members above, or skip this step.
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          style={{
            flex: "0 0 auto",
            padding: "11px 20px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            color: "var(--text-secondary)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onNext(invites)}
          disabled={isLoading}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "11px 20px",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            border: "none",
            borderRadius: 10,
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.75 : 1,
          }}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
          {isLoading ? "Saving..." : invites.length > 0 ? `Invite ${invites.length} Member${invites.length > 1 ? "s" : ""}` : "Skip for now"}
          {!isLoading && (invites.length > 0 ? <ArrowRight size={16} /> : <ChevronRight size={16} />)}
        </button>
      </div>
    </div>
  );
}
