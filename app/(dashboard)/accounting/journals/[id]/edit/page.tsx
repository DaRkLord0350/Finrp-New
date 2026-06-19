"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { JournalEditor } from "@/components/accounting/JournalEditor";
import { useJournal, useJournalMutations, type CreateJournalPayload } from "@/hooks/useJournals";

export default function EditJournalPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const { journal, loading } = useJournal(id);
  const { update, post } = useJournalMutations();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (payload: CreateJournalPayload, shouldPost: boolean) => {
    setSubmitting(true);
    try {
      await update(id, payload);
      if (shouldPost) await post(id);
      router.push(`/accounting/journals/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;
  }
  if (!journal) {
    return <p style={{ color: "var(--text-muted)" }}>Journal not found.</p>;
  }
  if (journal.status !== "DRAFT") {
    return (
      <div>
        <Link href={`/accounting/journals/${id}`} style={{ color: "var(--brand-400)", fontSize: 13 }}>← Back</Link>
        <p style={{ color: "var(--text-secondary)", marginTop: 16 }}>
          Only draft journals can be edited. Posted entries must be reversed.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/accounting/journals/${id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, marginBottom: 16, textDecoration: "none" }}>
        <ArrowLeft size={14} /> Back to Journal
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 24 }}>Edit Draft Journal</h1>

      <JournalEditor
        mode="edit"
        initial={journal}
        submitting={submitting}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/accounting/journals/${id}`)}
      />
    </div>
  );
}
