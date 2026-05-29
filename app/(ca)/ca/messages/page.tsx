import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { MessageSquare, Send } from "lucide-react";
import MessageCompose from "./MessageCompose";

async function getCAMessages(caUserId: string) {
  const [messages, clients] = await Promise.all([
    prisma.cAMessage.findMany({
      where: { caUserId },
      orderBy: { sentAt: "desc" },
      take: 50,
    }),
    prisma.cAClient.findMany({
      where: { caUserId, isActive: true },
      include: {
        organization: { include: { businessProfile: true } },
      },
    }),
  ]);

  // Enrich messages with organization info
  const orgMap = new Map(clients.map((c) => [c.organizationId, c.organization]));
  const enriched = messages.map((m) => ({
    ...m,
    organization: orgMap.get(m.organizationId),
  }));

  return { messages: enriched, clients };
}

const MESSAGE_TEMPLATES = [
  { key: "DOCUMENT_REQUEST", label: "Document Request", preview: "Please upload the following documents for {compliance}..." },
  { key: "COMPLIANCE_REMINDER", label: "Compliance Reminder", preview: "This is a reminder that your {compliance} is due on {date}..." },
  { key: "CLARIFICATION_REQUIRED", label: "Clarification Required", preview: "We need clarification on the following items..." },
  { key: "APPROVAL_NOTICE", label: "Approval Notice", preview: "Your documents have been approved and filing is ready..." },
  { key: "REJECTION_NOTICE", label: "Rejection Notice", preview: "Unfortunately your documents could not be accepted..." },
  { key: "MISSING_INFORMATION", label: "Missing Information", preview: "We are missing the following required information..." },
];

export default async function CAMessagesPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole === "CUSTOMER") redirect("/dashboard");

  const { messages, clients } = await getCAMessages(user.id);

  return (
    <div className="page-container animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="section-title">Communication Center</h1>
        <p className="section-subtitle">Send messages and reminders to your clients</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>

        {/* Message History */}
        <div>
          <div className="section-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Sent Messages ({messages.length})
              </h2>
            </div>
            {messages.length === 0 ? (
              <div className="empty-state">
                <MessageSquare size={40} color="var(--text-muted)" />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No messages sent yet</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      padding: "14px 20px",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: "rgba(99,102,241,0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Send size={16} color="var(--brand-400)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {msg.subject}
                        </p>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, marginLeft: 8 }}>
                          {format(msg.sentAt, "dd MMM, HH:mm")}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        To: {msg.organization?.businessProfile?.businessName ?? msg.organization?.name ?? "Unknown Client"}
                        {msg.templateType && (
                          <span style={{ marginLeft: 8, padding: "1px 6px", borderRadius: 4, background: "rgba(99,102,241,0.1)", color: "var(--brand-400)", fontSize: 10, fontWeight: 600 }}>
                            {msg.templateType.replace("_", " ")}
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {msg.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Compose */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <MessageCompose
            clients={clients.map((c) => ({
              organizationId: c.organizationId,
              name: c.organization.businessProfile?.businessName ?? c.organization.name,
            }))}
            templates={MESSAGE_TEMPLATES}
          />
        </div>
      </div>
    </div>
  );
}
