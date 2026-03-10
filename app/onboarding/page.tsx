import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getBusinessByUser } from "@/services/businessService";
import BusinessOnboardingForm from "@/components/BusinessOnboardingForm";
import { Building2, Zap } from "lucide-react";

export const metadata = {
  title: "Set Up Your Business | FinRP",
  description: "Complete your business profile to get started with FinRP.",
};

export default async function OnboardingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // If business already exists, skip onboarding
  const existing = await getBusinessByUser(userId);
  if (existing) {
    redirect("/dashboard");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "fixed",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 400,
          background:
            "radial-gradient(ellipse, rgba(99,102,241,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ width: "100%", maxWidth: 560, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 40,
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
            <Zap size={18} color="white" />
          </div>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              background: "linear-gradient(135deg, #818cf8, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            FinRP
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: 20,
            padding: "36px 40px",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 28, textAlign: "center" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Building2 size={24} color="var(--brand-400)" />
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
              }}
            >
              Set Up Your Business
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              Tell us about your business to personalize your FinRP experience.
              This only takes a minute.
            </p>
          </div>

          {/* Step indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 28,
              padding: "10px 14px",
              background: "var(--bg-elevated)",
              borderRadius: 10,
            }}
          >
            {["Business Details", "Review", "Dashboard"].map((step, i) => (
              <div
                key={step}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background:
                      i === 0
                        ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                        : "var(--bg-overlay)",
                    border: `1px solid ${i === 0 ? "#6366f1" : "var(--border)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: i === 0 ? "white" : "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: i === 0 ? "var(--text-primary)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {step}
                </span>
                {i < 2 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "var(--border)",
                      marginLeft: "auto",
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          <BusinessOnboardingForm />
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          You can update these details anytime from Settings.
        </p>
      </div>
    </div>
  );
}
