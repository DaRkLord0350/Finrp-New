import { guardModule } from "@/lib/auth/require-module";
import LendingSidebar from "@/components/lending/LendingSidebar";

// Server guard — blocks roles without Lending access, then wraps every
// lending page in the module sidebar shell (mirrors the Accounting/Banking layout).
export default async function LendingLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardModule("lending");
  if (denied) return denied;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <LendingSidebar />
      <div style={{ flex: 1, overflow: "auto", minWidth: 0, padding: "28px 32px" }}>{children}</div>
    </div>
  );
}
