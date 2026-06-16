import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ClipboardList,
  MessageSquare,
  Paperclip,
  History,
  Download,
  User as UserIcon,
} from "lucide-react";
import { StatusSelect, AddComment, AddAttachment } from "@/components/firm/task/TaskActions";

const statusColor: Record<string, string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  WAITING_CLIENT: "#f97316",
  REVIEW: "#8b5cf6",
  COMPLETED: "#10b981",
};
const priorityColor: Record<string, string> = {
  LOW: "#94a3b8",
  MEDIUM: "#3b82f6",
  HIGH: "#f59e0b",
  CRITICAL: "#ef4444",
};

function activityText(a: { action: string; fromStatus: string | null; toStatus: string | null }): string {
  switch (a.action) {
    case "CREATED":
      return "created the task";
    case "STATUS_CHANGED":
      return `moved ${(a.fromStatus ?? "").replace("_", " ")} → ${(a.toStatus ?? "").replace("_", " ")}`;
    case "COMMENTED":
      return "commented";
    case "ATTACHMENT_ADDED":
      return "added an attachment";
    case "REASSIGNED":
      return "reassigned the task";
    default:
      return "updated the task";
  }
}

function fmtSize(b: number) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const { id } = await params;
  const task = await prisma.firmTask.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      customer: { select: { id: true, name: true } },
      assignedCa: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      comments: { orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!task) notFound();

  const overdue = task.dueDate < new Date() && task.status !== "COMPLETED";

  return (
    <div className="page-container animate-fade-in">
      <Link
        href="/firm/tasks"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Back to Tasks
      </Link>

      {/* Header */}
      <div className="section-card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ClipboardList size={18} color="#6366f1" />
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{task.title}</h1>
            </div>
            {task.description && (
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>{task.description}</p>
            )}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "var(--text-muted)" }}>
              <span>
                Customer:{" "}
                <Link href={`/firm/customers/${task.customer.id}`} style={{ color: "var(--brand-400)", textDecoration: "none" }}>
                  {task.customer.name}
                </Link>
              </span>
              <span>Assignee: <strong style={{ color: "var(--text-secondary)" }}>{task.assignedCa.name ?? task.assignedCa.email}</strong></span>
              <span>Created by: {task.createdBy.name ?? task.createdBy.email}</span>
              <span style={{ color: overdue ? "#ef4444" : "var(--text-muted)" }}>Due {format(task.dueDate, "dd MMM yyyy")}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            <span className="badge" style={{ background: `${priorityColor[task.priority]}18`, color: priorityColor[task.priority], borderColor: `${priorityColor[task.priority]}30` }}>
              {task.priority}
            </span>
            <StatusSelect taskId={task.id} status={task.status} />
            <span style={{ fontSize: 11, color: statusColor[task.status] }}>● {task.status.replace("_", " ")}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        {/* Comments */}
        <div className="section-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <MessageSquare size={16} color="#0ea5e9" />
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Comments ({task.comments.length})
            </h2>
          </div>
          {task.comments.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No comments yet. Start the discussion.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {task.comments.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "rgba(99,102,241,0.15)",
                      color: "#6366f1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {(c.authorName ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12.5 }}>
                      <strong style={{ color: "var(--text-primary)" }}>{c.authorName ?? "—"}</strong>{" "}
                      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                        {formatDistanceToNow(c.createdAt, { addSuffix: true })}
                      </span>
                    </p>
                    <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 2, whiteSpace: "pre-wrap" }}>{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <AddComment taskId={task.id} />
        </div>

        {/* Right: attachments + history */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Paperclip size={16} color="#10b981" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Attachments</h2>
              <div style={{ marginLeft: "auto" }}>
                <AddAttachment taskId={task.id} />
              </div>
            </div>
            {task.attachments.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No attachments.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {task.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.fileUrl}
                    download={att.fileName}
                    target="_blank"
                    rel="noopener"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      background: "var(--bg-elevated)",
                      borderRadius: 8,
                      textDecoration: "none",
                    }}
                  >
                    <Download size={13} color="var(--text-muted)" />
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {att.fileName}
                    </span>
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{fmtSize(att.fileSize)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="section-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <History size={16} color="#8b5cf6" />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>History</h2>
            </div>
            {task.activities.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No history yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {task.activities.map((a) => (
                  <div key={a.id} style={{ display: "flex", gap: 10 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8b5cf6", marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                        <UserIcon size={10} style={{ verticalAlign: "middle", marginRight: 4, color: "var(--text-muted)" }} />
                        <strong style={{ color: "var(--text-primary)" }}>{a.actorName ?? "—"}</strong> {activityText(a)}
                      </p>
                      <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                        {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
