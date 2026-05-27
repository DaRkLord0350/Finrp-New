"use client";

// ============================================================
// Step 6 — Demo Data Seeder
// Only shown when user selected "Demo Data" in Step 5.
// ============================================================

import { useState } from "react";
import { Loader2, ArrowRight, Sparkles, Users, FileText, Package, Wallet, UserCheck, Check } from "lucide-react";
import type { DemoSeedResult } from "@/types/onboarding";

interface DemoDataStepProps {
  onSeed: () => Promise<DemoSeedResult>;
  onNext: () => void;
  onBack: () => void;
  isLoading: boolean;
}

const SEED_ITEMS = [
  { icon: Users, label: "Customers", count: "8 sample customers", color: "#6366f1" },
  { icon: Package, label: "Products", count: "10 inventory items", color: "#10b981" },
  { icon: FileText, label: "Invoices", count: "12 invoices with history", color: "#3b82f6" },
  { icon: Wallet, label: "Expenses", count: "8 operational expenses", color: "#f59e0b" },
  { icon: UserCheck, label: "Employees", count: "5 employee records", color: "#ec4899" },
];

export function DemoDataStep({ onSeed, onNext, onBack, isLoading }: DemoDataStepProps) {
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<DemoSeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSeed() {
    setSeeding(true);
    setError(null);
    try {
      const res = await onSeed();
      if (res.success) {
        setSeeded(true);
        setResult(res);
      } else {
        setError(res.error ?? "Failed to generate demo data");
      }
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.5 }}>
        We&apos;ll generate realistic sample data so you can explore all features right away.
        This takes just a few seconds.
      </p>

      {/* Preview of what will be seeded */}
      <div
        style={{
          background: "var(--bg-elevated)",
          borderRadius: 12,
          border: "1px solid var(--border)",
          padding: "14px",
          marginBottom: 20,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Will be generated
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SEED_ITEMS.map(({ icon: Icon, label, count, color }) => (
            <div
              key={label}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: `${color}15`,
                  border: `1px solid ${color}25`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={13} color={color} />
              </div>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>
                {count}
              </span>
              {seeded && result?.success && (
                <Check size={14} color="#10b981" strokeWidth={3} />
              )}
            </div>
          ))}
        </div>
      </div>

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

      {seeded && (
        <div
          style={{
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 10,
            padding: "12px 14px",
            color: "#10b981",
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Check size={16} strokeWidth={3} />
          Demo data generated successfully! Your workspace is ready to explore.
        </div>
      )}

      {/* Seed button */}
      {!seeded && (
        <button
          type="button"
          onClick={handleSeed}
          disabled={seeding || isLoading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 20px",
            background: seeding
              ? "var(--bg-elevated)"
              : "linear-gradient(135deg, #6366f1, #4f46e5)",
            border: seeding ? "1px solid var(--border)" : "none",
            borderRadius: 10,
            color: seeding ? "var(--text-secondary)" : "white",
            fontSize: 14,
            fontWeight: 600,
            cursor: seeding ? "not-allowed" : "pointer",
            marginBottom: 16,
          }}
        >
          {seeding ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating demo data...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Demo Data
            </>
          )}
        </button>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={onBack}
          disabled={seeding || isLoading}
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
          onClick={onNext}
          disabled={seeding || isLoading}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "11px 20px",
            background: seeded
              ? "linear-gradient(135deg, #6366f1, #4f46e5)"
              : "var(--bg-elevated)",
            border: seeded ? "none" : "1px solid var(--border)",
            borderRadius: 10,
            color: seeded ? "white" : "var(--text-secondary)",
            fontSize: 14,
            fontWeight: 600,
            cursor: seeding ? "not-allowed" : "pointer",
          }}
        >
          {seeded ? "Continue" : "Skip this step"}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
