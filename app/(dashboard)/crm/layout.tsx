import { guardModule } from "@/lib/auth/require-module";

// Server guard — blocks roles without CRM access (e.g. ACCOUNTANT)
// on direct URL entry. The sidebar already locks the nav item.
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardModule("crm");
  if (denied) return denied;
  return <>{children}</>;
}
