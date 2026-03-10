import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div className="main-content" style={{ flex: 1 }}>
        <Topbar />
        <main className="page-container animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
