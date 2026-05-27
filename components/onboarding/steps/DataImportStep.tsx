"use client";

// ============================================================
// Step 5 — Initial Data Setup
// ============================================================

import { useState } from "react";
import { ArrowRight, Upload, RefreshCw, Database, Sparkles, XCircle, Check } from "lucide-react";
import type { DataImportOption } from "@/types/onboarding";

interface DataImportStepProps {
  initialOption: DataImportOption | null;
  onNext: (option: DataImportOption) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

interface ImportOptionDef {
  id: DataImportOption;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  badge?: string;
}

const OPTIONS: ImportOptionDef[] = [
  {
    id: "DEMO",
    label: "Use Demo Data",
    description: "Start with realistic sample data — customers, invoices, and reports",
    icon: Sparkles,
    color: "#6366f1",
    badge: "Recommended",
  },
  {
    id: "EMPTY",
    label: "Start Empty",
    description: "Begin with a blank workspace and add your data manually",
    icon: XCircle,
    color: "#6b7280",
  },
  {
    id: "CSV",
    label: "Import from CSV",
    description: "Upload a CSV file with your existing customers, invoices, or products",
    icon: Upload,
    color: "#10b981",
  },
  {
    id: "ZOHO",
    label: "Import from Zoho",
    description: "Connect your Zoho Books or Zoho CRM account",
    icon: RefreshCw,
    color: "#3b82f6",
  },
  {
    id: "TALLY",
    label: "Import from Tally",
    description: "Import data exported from Tally ERP 9 or TallyPrime",
    icon: Database,
    color: "#f59e0b",
  },
];

export function DataImportStep({
  initialOption,
  onNext,
  onBack,
  isLoading,
}: DataImportStepProps) {
  const [selected, setSelected] = useState<DataImportOption | null>(initialOption);
  const [error, setError] = useState<string | null>(null);

  async function handleNext() {
    if (!selected) {
      setError("Please select an option to continue");
      return;
    }
    setError(null);
    await onNext(selected);
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
        How would you like to start? You can import your existing data or begin fresh.
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

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setSelected(opt.id);
                setError(null);
              }}
              disabled={isLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                background: isSelected ? `${opt.color}10` : "var(--bg-elevated)",
                border: `1.5px solid ${isSelected ? opt.color : "var(--border)"}`,
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${opt.color}18`,
                  border: `1px solid ${opt.color}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={18} color={opt.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: isSelected ? opt.color : "var(--text-primary)",
                    }}
                  >
                    {opt.label}
                  </span>
                  {opt.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: opt.color,
                        background: `${opt.color}18`,
                        padding: "2px 7px",
                        borderRadius: 6,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {opt.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {opt.description}
                </span>
              </div>
              {isSelected && (
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: opt.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Check size={13} color="white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
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
          type="button"
          onClick={handleNext}
          disabled={isLoading || !selected}
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
            cursor: isLoading || !selected ? "not-allowed" : "pointer",
            opacity: !selected || isLoading ? 0.6 : 1,
          }}
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
