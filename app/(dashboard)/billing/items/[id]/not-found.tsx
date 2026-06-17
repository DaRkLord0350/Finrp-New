import Link from "next/link";
import { PackageX, ArrowLeft } from "lucide-react";

export default function ItemNotFound() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", padding: "80px 24px" }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "rgba(99,102,241,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
        }}
      >
        <PackageX size={28} color="var(--brand-400)" />
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        Item not found
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
        This item may have been deleted, or the link is no longer valid.
      </p>
      <Link
        href="/billing/items"
        className="btn-brand"
        style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        <ArrowLeft size={15} /> Back to Inventory
      </Link>
    </div>
  );
}
