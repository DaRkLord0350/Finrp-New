"use client";

// ============================================================
// Step 7 — Preferences
// ============================================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowRight, Sun, Moon, Monitor, Bell, BellOff, LayoutDashboard } from "lucide-react";
import { preferencesSchema, type PreferencesInput } from "@/validators/onboarding";
import type { ThemePreference, DashboardLayout } from "@/types/onboarding";

interface PreferencesStepProps {
  initialValues: {
    theme: ThemePreference;
    emailNotifications: boolean;
    smsNotifications: boolean;
    dashboardLayout: DashboardLayout;
  };
  onNext: (data: PreferencesInput) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

const THEMES: { value: ThemePreference; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
];

const LAYOUTS: { value: DashboardLayout; label: string; description: string }[] = [
  { value: "default", label: "Default", description: "Balanced view with KPI cards and charts" },
  { value: "compact", label: "Compact", description: "Dense list view, less whitespace" },
  { value: "detailed", label: "Detailed", description: "Maximum info, full analytics visible" },
];

export function PreferencesStep({
  initialValues,
  onNext,
  onBack,
  isLoading,
}: PreferencesStepProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<PreferencesInput>({
      resolver: zodResolver(preferencesSchema),
      defaultValues: {
        theme: initialValues.theme,
        emailNotifications: initialValues.emailNotifications,
        smsNotifications: initialValues.smsNotifications,
        dashboardLayout: initialValues.dashboardLayout,
      },
    });

  const theme = watch("theme");
  const layout = watch("dashboardLayout");
  const emailNotif = watch("emailNotifications");
  const smsNotif = watch("smsNotifications");

  return (
    <form onSubmit={handleSubmit(onNext)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Theme */}
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: 10,
              letterSpacing: "0.02em",
            }}
          >
            THEME
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {THEMES.map(({ value, label, icon: Icon }) => {
              const isSelected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue("theme", value)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 8px",
                    background: isSelected ? "rgba(99,102,241,0.1)" : "var(--bg-elevated)",
                    border: `1.5px solid ${isSelected ? "#6366f1" : "var(--border)"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Icon size={18} color={isSelected ? "#6366f1" : "var(--text-muted)"} />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: isSelected ? "#6366f1" : "var(--text-secondary)",
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Hidden input for form */}
          <input type="hidden" {...register("theme")} />
        </div>

        {/* Dashboard Layout */}
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: 10,
              letterSpacing: "0.02em",
            }}
          >
            DASHBOARD LAYOUT
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {LAYOUTS.map(({ value, label, description }) => {
              const isSelected = layout === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue("dashboardLayout", value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    background: isSelected ? "rgba(99,102,241,0.08)" : "var(--bg-elevated)",
                    border: `1.5px solid ${isSelected ? "#6366f1" : "var(--border)"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: `2px solid ${isSelected ? "#6366f1" : "var(--border)"}`,
                      background: isSelected ? "#6366f1" : "transparent",
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: isSelected ? "#6366f1" : "var(--text-primary)", marginBottom: 2 }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <input type="hidden" {...register("dashboardLayout")} />
        </div>

        {/* Notifications */}
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              display: "block",
              marginBottom: 10,
              letterSpacing: "0.02em",
            }}
          >
            NOTIFICATIONS
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              {
                key: "emailNotifications" as const,
                label: "Email Notifications",
                description: "Invoices, reminders, and compliance alerts",
                icon: Bell,
                value: emailNotif,
              },
              {
                key: "smsNotifications" as const,
                label: "SMS Notifications",
                description: "Critical alerts and payment reminders",
                icon: Bell,
                value: smsNotif,
              },
            ].map(({ key, label, description, icon: Icon, value }) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: value ? "rgba(99,102,241,0.12)" : "var(--bg-overlay)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {value ? (
                    <Icon size={15} color="#6366f1" />
                  ) : (
                    <BellOff size={15} color="var(--text-muted)" />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setValue(key, !value)}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: value ? "#6366f1" : "var(--bg-overlay)",
                    border: "none",
                    cursor: "pointer",
                    position: "relative",
                    transition: "background 0.2s ease",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "white",
                      top: 3,
                      left: value ? 21 : 3,
                      transition: "left 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }}
                  />
                </button>
                <input type="hidden" {...register(key)} />
              </div>
            ))}
          </div>
        </div>

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
            type="submit"
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
            {isLoading ? "Saving..." : "Continue"}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </form>
  );
}
