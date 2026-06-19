"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { JournalEditor } from "@/components/accounting/JournalEditor";
import { useJournalMutations, type CreateJournalPayload } from "@/hooks/useJournals";

export default function NewJournalPage() {
  const router = useRouter();
  const { create } = useJournalMutations();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (payload: CreateJournalPayload) => {
    setSubmitting(true);
    try {
      const created = await create(payload);
      router.push(`/accounting/journals/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Link href="/accounting/journals" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, marginBottom: 16, textDecoration: "none" }}>
        <ArrowLeft size={14} /> Back to Journals
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>New Journal Entry</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>
        Save as a draft to review later, or post directly to the ledger.
      </p>

      <JournalEditor
        mode="create"
        submitting={submitting}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/accounting/journals")}
      />
    </div>
  );
}
