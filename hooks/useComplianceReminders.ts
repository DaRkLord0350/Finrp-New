"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ComplianceReminderRecord,
  CreateComplianceReminderInput,
} from "@/types/compliance";

interface RemindersState {
  reminders: ComplianceReminderRecord[];
  loading: boolean;
  error: string | null;
}

type ReminderFilter = "all" | "pending" | "upcoming";

export function useComplianceReminders(filter: ReminderFilter = "all", days = 30) {
  const [state, setState] = useState<RemindersState>({
    reminders: [],
    loading: true,
    error: null,
  });

  const fetchReminders = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (filter === "upcoming") params.set("days", String(days));
      const res = await fetch(`/api/compliance/reminders?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      const data: ComplianceReminderRecord[] = await res.json();
      setState({ reminders: data, loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load reminders",
      }));
    }
  }, [filter, days]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const createReminder = useCallback(async (input: CreateComplianceReminderInput) => {
    const res = await fetch("/api/compliance/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to create reminder");
    }
    await fetchReminders();
    return (await res.json()) as ComplianceReminderRecord;
  }, [fetchReminders]);

  const dismissReminder = useCallback(async (id: string) => {
    const res = await fetch(`/api/compliance/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to dismiss reminder");
    }
    await fetchReminders();
  }, [fetchReminders]);

  const triggerReminder = useCallback(async (id: string) => {
    const res = await fetch(`/api/compliance/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trigger" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to trigger reminder");
    }
    await fetchReminders();
  }, [fetchReminders]);

  const deleteReminder = useCallback(async (id: string) => {
    const res = await fetch(`/api/compliance/reminders/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Failed to delete reminder");
    }
    setState((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) }));
  }, []);

  return {
    reminders: state.reminders,
    loading: state.loading,
    error: state.error,
    refetch: fetchReminders,
    createReminder,
    dismissReminder,
    triggerReminder,
    deleteReminder,
  };
}
