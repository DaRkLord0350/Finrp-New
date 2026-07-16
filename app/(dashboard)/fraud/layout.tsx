import { guardModule } from "@/lib/auth/require-module";
import FraudSidebar from "@/components/fraud/FraudSidebar";

export default async function FraudLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardModule("fraud");
  if (denied) return denied;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <FraudSidebar />
      <div style={{ flex: 1, overflow: "auto", minWidth: 0, padding: "28px 32px" }}>{children}</div>
    </div>
  );
}
