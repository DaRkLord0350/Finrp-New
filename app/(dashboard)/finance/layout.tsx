import { guardModule } from "@/lib/auth/require-module";

// Server guard — blocks roles without Finance access (e.g. STAFF).
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardModule("finance");
  if (denied) return denied;
  return <>{children}</>;
}
