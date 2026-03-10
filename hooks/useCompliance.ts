"use client";

import { useEffect, useState } from "react";
import type { ComplianceTask } from "@/types";

export function useCompliance() {
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/compliance");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const createTask = async (data: {
    title: string;
    description?: string;
    category: string;
    dueDate: string;
  }) => {
    const res = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create task");
    const task = await res.json();
    setTasks((prev) => [...prev, task]);
    return task;
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/compliance/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update task");
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: status as ComplianceTask["status"] } : t
      )
    );
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/compliance/${id}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const counts = {
    pending: tasks.filter((t) => t.status === "PENDING").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    overdue: tasks.filter((t) => t.status === "OVERDUE").length,
  };

  return { tasks, loading, error, counts, createTask, updateStatus, deleteTask, refetch: fetchTasks };
}
