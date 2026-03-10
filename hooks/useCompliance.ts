"use client";

// ============================================================
// useCompliance — Full CRUD hook for compliance tasks
// ============================================================

import { useState, useEffect, useCallback } from "react";

export interface ComplianceTask {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  status: string;
  dueDate: string;
  completedAt?: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export function useCompliance() {
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/compliance");
      if (!res.ok) throw new Error("Failed to fetch compliance tasks");
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const createTask = async (input: {
    title: string;
    description?: string;
    category: string;
    dueDate: string;
  }): Promise<ComplianceTask> => {
    const res = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to create task");
    }
    const task = await res.json() as ComplianceTask;
    setTasks((prev) => [task, ...prev]);
    return task;
  };

  const updateTaskStatus = async (id: string, status: string): Promise<ComplianceTask> => {
    const res = await fetch(`/api/compliance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to update task");
    }
    const updated = await res.json() as ComplianceTask;
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  };

  const deleteTask = async (id: string): Promise<void> => {
    const res = await fetch(`/api/compliance/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to delete task");
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return { tasks, loading, error, refetch: fetchTasks, createTask, updateTaskStatus, deleteTask };
}
