import { guardModule } from "@/lib/auth/require-module";
import AMLSidebar from "@/components/aml/AMLSidebar";

export default async function AMLLayout({ children }: { children: React.ReactNode }) {
  const denied = await guardModule("aml");
  if (denied) return denied;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <AMLSidebar />
      <div style={{ flex: 1, overflow: "auto", minWidth: 0, padding: "28px 32px" }}>{children}</div>
    </div>
  );
}
