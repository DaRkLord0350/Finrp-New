import Link from "next/link";

export default function MyReportsPage() {
  return (
    <div style={{ padding: "24px 32px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>My Reports</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
        Custom reports you create will appear here. Start by running a{" "}
        <Link href="/reports" style={{ color: "var(--accent)" }}>standard report</Link>.
      </p>
    </div>
  );
}
