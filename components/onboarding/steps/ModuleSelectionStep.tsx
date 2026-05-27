"use client";

// ============================================================
// Step 3 — Module Selection
// ============================================================

import { useState } from "react";
import { Loader2, ArrowRight, BarChart3, Package, Calculator, Users, FileText, TrendingUp, Check } from "lucide-react";
import type { OnboardingModule } from "@/types/onboarding";

interface ModuleSelectionStepProps {
  initialModules: OnboardingModule[];
  onNext: (modules: OnboardingModule[]) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

interface ModuleDef {
  id: OnboardingModule;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  recommended: boolean;
}

const MODULES: ModuleDef[] = [
  {
    id: "CRM",
    label: "CRM",
    description: "Manage customers, leads, and sales pipeline",
    icon: Users,
    color: "#6366f1",
    recommended: true,
  },
  {
    id: "BILLING",
    label: "Billing",
    description: "Invoices, payments, and recurring billing",
    icon: FileText,
    color: "#10b981",
    recommended: true,
  },
  {
    id: "ACCOUNTING",
    label: "Accounting",
    description: "Double-entry ledger, bank accounts, and journals",
    icon: Calculator,
    color: "#f59e0b",
    recommended: true,
  },
  {
    id: "INVENTORY",
    label: "Inventory",
    description: "Products, stock management, and purchase orders",
    icon: Package,
    color: "#3b82f6",
    recommended: false,
  },
  {
    id: "HR",
    label: "HR & Payroll",
    description: "Employee management and payroll processing",
    icon: Users,
    color: "#ec4899",
    recommended: false,
  },
  {
    id: "ANALYTICS",
    label: "Analytics",
    description: "Business insights, reports, and KPI dashboards",
    icon: BarChart3,
    color: "#8b5cf6",
    recommended: false,
  },
];

export function ModuleSelectionStep({
  initialModules,
  onNext,
  onBack,
  isLoading,
}: ModuleSelectionStepProps) {
  const [selected, setSelected] = useState<Set<OnboardingModule>>(
    new Set(initialModules)
  );
  const [error, setError] = useState<string | null>(null);

  function toggleModule(id: OnboardingModule) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // must keep at least one
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setError(null);
  }

  async function handleNext() {
    if (selected.size === 0) {
      setError("Please select at least one module");
      return;
    }
    await onNext(Array.from(selected));
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
        Choose the modules you want to enable. You can change this anytime from Settings.
      </p>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            color: "#ef4444",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 24,
        }}
      >
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const isSelected = selected.has(mod.id);
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => toggleModule(mod.id)}
              disabled={isLoading}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 6,
                padding: "14px 14px",
                background: isSelected ? `${mod.color}10` : "var(--bg-elevated)",
                border: `1.5px solid ${isSelected ? mod.color : "var(--border)"}`,
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
              }}
            >
              {mod.recommended && (
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    fontSize: 9,
                    fontWeight: 700,
                    color: mod.color,
                    background: `${mod.color}18`,
                    padding: "2px 6px",
                    borderRadius: 6,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Recommended
                </span>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: `${mod.color}18`,
                    border: `1px solid ${mod.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} color={mod.color} />
                </div>
                {isSelected && (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: mod.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: "auto",
                    }}
                  >
                    <Check size={11} color="white" strokeWidth={3} />
                  </div>
                )}
              </div>

              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: isSelected ? mod.color : "var(--text-primary)",
                }}
              >
                {mod.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                {mod.description}
              </span>
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 18, textAlign: "center" }}>
        {selected.size} of {MODULES.length} modules selected
      </p>

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
          onClick={handleNext}
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
  );
}
