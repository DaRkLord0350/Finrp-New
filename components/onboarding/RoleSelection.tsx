"use client";

// ============================================================
// RoleSelection — Premium role selection UI.
// Renders two large, animated selection cards.
// Calls actionSelectRole on confirm and redirects.
// ============================================================

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Building2,
  Check,
  ArrowRight,
  Loader2,
  Zap,
  BarChart3,
  FileCheck,
  Briefcase,
  UserCheck,
  TrendingUp,
  FolderOpen,
  Globe,
} from "lucide-react";
import { actionSelectRole, type SelectableRole } from "@/actions/role";

// ---------------------------------------------------------------------------
// Card data
// ---------------------------------------------------------------------------
const ROLES = [
  {
    id: "CA_FIRM_ADMIN" as SelectableRole,
    title: "CA Firm",
    subtitle: "Chartered Accountant Practice",
    icon: Building2,
    gradient: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    glowColor: "rgba(99,102,241,0.25)",
    borderActive: "#6366f1",
    accentColor: "#818cf8",
    features: [
      { icon: Users, text: "Manage multiple clients from one dashboard" },
      { icon: UserCheck, text: "Assign work to team members" },
      { icon: FileCheck, text: "Track compliance across all clients" },
      { icon: BarChart3, text: "Workload and analytics reporting" },
      { icon: FolderOpen, text: "Document management and e-signing" },
    ],
    badge: "For CA Professionals",
  },
  {
    id: "CUSTOMER" as SelectableRole,
    title: "Customer",
    subtitle: "Business Owner",
    icon: Briefcase,
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    glowColor: "rgba(16,185,129,0.25)",
    borderActive: "#10b981",
    accentColor: "#34d399",
    features: [
      { icon: TrendingUp, text: "Manage your business financials" },
      { icon: FileCheck, text: "Track compliance and deadlines" },
      { icon: FolderOpen, text: "Upload and organize documents" },
      { icon: Globe, text: "Connect Zoho, Tally, and more" },
      { icon: BarChart3, text: "Real-time reports and analytics" },
    ],
    badge: "For Business Owners",
  },
] as const;

// ---------------------------------------------------------------------------
// Inline style helpers (matching existing codebase conventions)
// ---------------------------------------------------------------------------
const baseCard: React.CSSProperties = {
  position: "relative",
  background: "var(--bg-surface)",
  border: "2px solid var(--border)",
  borderRadius: 20,
  padding: "32px 28px",
  cursor: "pointer",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  overflow: "hidden",
  flex: 1,
  minWidth: 0,
  outline: "none",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function RoleSelection() {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectableRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<SelectableRole | null>(null);

  const handleSelect = useCallback((id: SelectableRole) => {
    if (!isLoading) setSelected(id);
  }, [isLoading]);

  const handleContinue = useCallback(async () => {
    if (!selected || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await actionSelectRole(selected);
      if (!result.success) {
        setError(result.error ?? "Something went wrong. Please try again.");
        setIsLoading(false);
        return;
      }
      router.push(result.redirectTo!);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }, [selected, isLoading, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: SelectableRole) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect(id);
      }
    },
    [handleSelect]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 16px 64px",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      {/* Ambient background glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 700,
          background:
            "radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 65%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 860,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #6366f1, #10b981)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={17} color="white" />
          </div>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              background: "linear-gradient(135deg, #818cf8, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.025em",
            }}
          >
            FinRP
          </span>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          style={{ textAlign: "center", marginBottom: 44 }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--brand-400)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Step 1 of 1 — Account Type
          </p>
          <h1
            style={{
              fontSize: "clamp(26px, 4vw, 36px)",
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              marginBottom: 12,
            }}
          >
            How will you use FinRP?
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              maxWidth: 460,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            This determines your dashboard, permissions, and onboarding flow.
            You can&apos;t change this later.
          </p>
        </motion.div>

        {/* Role cards */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginBottom: 36,
            flexWrap: "wrap",
          }}
          role="radiogroup"
          aria-label="Select account type"
        >
          {ROLES.map((role, idx) => {
            const isSelected = selected === role.id;
            const isHovered = hoveredId === role.id;
            const Icon = role.icon;

            return (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + idx * 0.07 }}
                style={{ flex: "1 1 340px", minWidth: 0 }}
              >
                <div
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => handleSelect(role.id)}
                  onKeyDown={(e) => handleKeyDown(e, role.id)}
                  onMouseEnter={() => setHoveredId(role.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    ...baseCard,
                    borderColor: isSelected
                      ? role.borderActive
                      : isHovered
                      ? "var(--border-strong)"
                      : "var(--border)",
                    boxShadow: isSelected
                      ? `0 0 0 3px ${role.glowColor}, 0 20px 40px rgba(0,0,0,0.15)`
                      : isHovered
                      ? "0 12px 32px rgba(0,0,0,0.12)"
                      : "var(--shadow-lg)",
                    transform: isSelected
                      ? "translateY(-4px)"
                      : isHovered
                      ? "translateY(-2px)"
                      : "none",
                  }}
                >
                  {/* Card glow overlay */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: `radial-gradient(ellipse at top left, ${role.glowColor} 0%, transparent 60%)`,
                          pointerEvents: "none",
                          borderRadius: 18,
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* Badge */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: isSelected
                        ? `linear-gradient(135deg, ${role.borderActive}22, ${role.borderActive}11)`
                        : "var(--bg-elevated)",
                      border: `1px solid ${isSelected ? role.borderActive + "44" : "var(--border)"}`,
                      marginBottom: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      color: isSelected ? role.accentColor : "var(--text-muted)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    {role.badge}
                  </div>

                  {/* Icon + selection indicator */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: isSelected
                          ? role.gradient
                          : "var(--bg-elevated)",
                        border: `1px solid ${isSelected ? "transparent" : "var(--border)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.25s ease",
                        flexShrink: 0,
                      }}
                    >
                      <Icon
                        size={22}
                        color={isSelected ? "white" : "var(--text-muted)"}
                        strokeWidth={isSelected ? 2 : 1.5}
                      />
                    </div>

                    {/* Selection check */}
                    <motion.div
                      initial={false}
                      animate={{
                        scale: isSelected ? 1 : 0.7,
                        opacity: isSelected ? 1 : 0,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: role.gradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Check size={13} color="white" strokeWidth={3} />
                    </motion.div>
                  </div>

                  {/* Title */}
                  <h2
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: "var(--text-primary)",
                      letterSpacing: "-0.025em",
                      marginBottom: 4,
                    }}
                  >
                    {role.title}
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-muted)",
                      marginBottom: 24,
                      fontWeight: 500,
                    }}
                  >
                    {role.subtitle}
                  </p>

                  {/* Feature list */}
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                    aria-label={`${role.title} features`}
                  >
                    {role.features.map((feature, fi) => {
                      const FIcon = feature.icon;
                      return (
                        <li
                          key={fi}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 7,
                              background: isSelected
                                ? `${role.borderActive}18`
                                : "var(--bg-elevated)",
                              border: `1px solid ${isSelected ? role.borderActive + "30" : "var(--border)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              transition: "all 0.2s ease",
                            }}
                          >
                            <FIcon
                              size={13}
                              color={isSelected ? role.accentColor : "var(--text-muted)"}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 13,
                              color: isSelected
                                ? "var(--text-primary)"
                                : "var(--text-secondary)",
                              lineHeight: 1.4,
                              transition: "color 0.2s ease",
                            }}
                          >
                            {feature.text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* CTA inside card */}
                  <div
                    style={{
                      marginTop: 28,
                      padding: "12px 18px",
                      borderRadius: 12,
                      background: isSelected
                        ? role.gradient
                        : "var(--bg-elevated)",
                      border: `1px solid ${isSelected ? "transparent" : "var(--border)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.25s ease",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isSelected ? "white" : "var(--text-muted)",
                        transition: "color 0.2s ease",
                      }}
                    >
                      {isSelected ? "Selected" : `Continue as ${role.title}`}
                    </span>
                    {isSelected ? (
                      <Check size={14} color="white" strokeWidth={3} />
                    ) : (
                      <ArrowRight
                        size={14}
                        color="var(--text-muted)"
                        strokeWidth={2}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444",
                fontSize: 13,
                fontWeight: 500,
                textAlign: "center",
              }}
              role="alert"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <button
            onClick={handleContinue}
            disabled={!selected || isLoading}
            aria-disabled={!selected || isLoading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "15px 24px",
              background:
                selected && !isLoading
                  ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                  : "var(--bg-elevated)",
              border: "none",
              borderRadius: 14,
              color:
                selected && !isLoading ? "white" : "var(--text-muted)",
              fontSize: 15,
              fontWeight: 700,
              cursor:
                selected && !isLoading ? "pointer" : "not-allowed",
              transition: "all 0.25s ease",
              boxShadow:
                selected && !isLoading
                  ? "0 8px 24px rgba(99,102,241,0.3)"
                  : "none",
            }}
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            {isLoading
              ? "Setting up your account…"
              : selected
              ? `Continue as ${ROLES.find((r) => r.id === selected)?.title}`
              : "Select an account type to continue"}
            {!isLoading && selected && <ArrowRight size={18} strokeWidth={2.5} />}
          </button>
        </motion.div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          This selection cannot be changed after setup.
          <br />
          Need help?{" "}
          <a
            href="mailto:support@finrp.in"
            style={{ color: "var(--brand-400)", textDecoration: "none", fontWeight: 600 }}
          >
            Contact support
          </a>
        </motion.p>
      </div>
    </div>
  );
}
