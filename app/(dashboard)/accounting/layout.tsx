import { guardModule } from "@/lib/auth/require-module";
import AccountingSidebar from "@/components/accounting/AccountingSidebar";

// Server guard — blocks roles without Accounting access, then wraps every
// accounting page in the module sidebar shell (mirrors the Banking OS layout).
export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardModule("accounting");
  if (denied) return denied;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <AccountingSidebar />
      <div style={{ flex: 1, overflow: "auto", minWidth: 0, padding: "28px 32px" }}>
        {children}
      </div>
    </div>
  );
}
