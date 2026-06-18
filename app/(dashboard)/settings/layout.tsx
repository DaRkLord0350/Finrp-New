import SettingsSidebar from "@/components/settings/SettingsSidebar";
import { guardModule } from "@/lib/auth/require-module";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Settings is OWNER/ADMIN only — block everyone else from the whole area.
  const denied = await guardModule("settings");
  if (denied) return denied;

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 57px)" }}>
      <SettingsSidebar />
      <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
    </div>
  );
}
