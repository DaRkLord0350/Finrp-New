import { headers } from "next/headers";
import { guardModule } from "@/lib/auth/require-module";

// Server guard for the ERP module. Payroll lives at /erp/payroll but
// is its OWN module (ACCOUNTANT has Payroll without ERP), so we skip
// the ERP check there and let erp/payroll/layout.tsx gate it.
export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-ws-path") ?? "";
  if (!path.startsWith("/erp/payroll")) {
    const denied = await guardModule("erp");
    if (denied) return denied;
  }
  return <>{children}</>;
}
