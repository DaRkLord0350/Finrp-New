import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import LandingHero from "@/components/LandingHero";
import FeatureSection from "@/components/FeatureSection";
import ProductPreview from "@/components/ProductPreview";
import LandingCTA from "@/components/LandingCTA";
import { Zap } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = {
  title: "FinRP — AI Financial Operations Platform",
  description:
    "FinRP unifies customer management, billing, compliance, inventory, and AI-powered analytics into one intelligent platform for modern businesses.",
};

export default async function HomePage() {
  // If already signed in, send to dashboard
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        overflowX: "hidden",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: 60,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 30,
              height: 30,
              background: "linear-gradient(135deg, #6366f1, #10b981)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={15} color="white" />
          </div>
          <span
            style={{
              fontSize: 18,
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

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <a
            href="#features"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "color 0.2s",
            }}
          >
            Features
          </a>
          <Link
            href="/sign-in"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            Sign In
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ThemeToggle />
            <Link
              href="/sign-up"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 16px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "white",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed nav */}
      <div style={{ height: 60 }} />

      {/* Page sections */}
      <LandingHero />
      <FeatureSection />
      <ProductPreview />
      <LandingCTA />

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              background: "linear-gradient(135deg, #6366f1, #10b981)",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={11} color="white" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)" }}>
            FinRP
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          © 2026 FinRP. All rights reserved.
        </p>
        <div style={{ display: "flex", gap: 20 }}>
          {["Privacy", "Terms", "Contact"].map((label) => (
            <a
              key={label}
              href="#"
              style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}
            >
              {label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
