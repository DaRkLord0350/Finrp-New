import BankingSidebar from "@/components/banking/BankingSidebar";

export default function BankingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      <BankingSidebar />
      <main style={{ flex: 1, overflowY: "auto", padding: "0" }}>
        {children}
      </main>
    </div>
  );
}
