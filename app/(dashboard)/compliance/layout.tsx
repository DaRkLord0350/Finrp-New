import { guardModule } from "@/lib/auth/require-module";

// Server guard — blocks roles without Compliance access (e.g. STAFF, VIEWER).
export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardModule("compliance");
  if (denied) return denied;
  return <>{children}</>;
}
