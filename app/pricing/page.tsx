// ============================================================
// /pricing — public pricing page
//
// Two sections (CA firms / Businesses) with plan comparison cards.
// Connected-aware: a signed-in business already linked to a CA sees
// "Included through your CA" and is only offered Connected Plus.
// ============================================================

import Link from "next/link";
import { Zap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { readCurrentUser } from "@/lib/auth/session";
import { getOrgEntitlements } from "@/lib/billing/guards";
import { toEntitlementsDTO, type EntitlementsDTO } from "@/lib/billing/entitlements";
import { getActivePlans } from "@/lib/billing/plans";
import { prisma } from "@/lib/prisma";
import { PricingExplorer } from "@/components/pricing/PricingExplorer";

export const metadata = {
  title: "Pricing — FinRP",
  description:
    "Simple, transparent pricing for Chartered Accountants and businesses. Start free, upgrade any time.",
};

export default async function PricingPage() {
  const user = await readCurrentUser().catch(() => null);

  let entitlements: EntitlementsDTO | null = null;
  let connectedToCA = false;
  let caName: string | null = null;

  if (user) {
    const ent = await getOrgEntitlements(user.organizationId).catch(() => null);
    if (ent) {
      entitlements = toEntitlementsDTO(ent);
      connectedToCA = ent.linkedToActiveCA;
      if (connectedToCA) {
        const org = await prisma.organization.findUnique({
          where: { id: user.organizationId },
          select: { linkedCAOrganization: { select: { name: true } } },
        });
        caName = org?.linkedCAOrganization?.name ?? null;
      }
    }
  }

  const plans = getActivePlans();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", overflowX: "hidden" }}>
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
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
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
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ThemeToggle />
          {user ? (
            <Link href="/dashboard" style={navLinkStyle}>Dashboard</Link>
          ) : (
            <>
              <Link href="/sign-in" style={navLinkStyle}>Sign In</Link>
              <Link
                href="/sign-up"
                style={{
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
            </>
          )}
        </div>
      </nav>

      <div style={{ height: 60 }} />

      {/* Hero */}
      <section style={{ textAlign: "center", padding: "56px 24px 36px" }}>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 46px)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-muted)", marginTop: 14, maxWidth: 560, margin: "14px auto 0" }}>
          Built for Chartered Accountants and the businesses they serve.
          Start <strong style={{ color: "var(--text-secondary)" }}>free</strong> — upgrade whenever you&apos;re ready.
        </p>
      </section>

      {/* Explorer */}
      <section style={{ padding: "0 24px 72px" }}>
        <PricingExplorer
          plans={plans}
          isAuthed={!!user}
          entitlements={entitlements}
          connectedToCA={connectedToCA}
          caName={caName}
        />
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "24px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          © 2026 FinRP. CA Practice Management & Financial Operations.
        </p>
      </footer>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-secondary)",
  textDecoration: "none",
};
