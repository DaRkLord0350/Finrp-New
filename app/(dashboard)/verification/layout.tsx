import { guardModule } from "@/lib/auth/require-module";
import VerificationSidebar from "@/components/verification/VerificationSidebar";

export default async function VerificationLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardModule("verification");
  if (denied) return denied;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <VerificationSidebar />
      <div style={{ flex: 1, overflow: "auto", minWidth: 0, padding: "28px 32px" }}>{children}</div>
    </div>
  );
}
