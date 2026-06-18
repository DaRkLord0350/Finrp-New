import { guardModule } from "@/lib/auth/require-module";

// Payroll is a distinct module: ACCOUNTANT (and ADMIN/OWNER) may access
// it even though they lack general ERP access. Gated on "payroll".
export default async function PayrollLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardModule("payroll");
  if (denied) return denied;
  return <>{children}</>;
}
