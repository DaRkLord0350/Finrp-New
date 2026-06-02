"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { MessageSquare, Send, User, UserCog } from "lucide-react";

interface Message {
  id: string;
  content: string;
  subject: string | null;
  isRead: boolean;
  createdAt: string;
  sender: { id: string; name: string | null; email: string; userRole: string };
  receiver: { id: string; name: string | null; email: string; userRole: string };
}

interface CAUser {
  id: string;
  name: string | null;
  email: string;
}

export default function CustomerMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [caUsers, setCaUsers] = useState<CAUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedCa, setSelectedCa] = useState<string>("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const [msgRes, caRes] = await Promise.all([
        fetch("/api/messages"),
        fetch("/api/customer/ca-users"),
      ]);
      const msgData = await msgRes.json();
      const caData = await caRes.json();
      setMessages(msgData.messages ?? []);
      setCaUsers(caData.caUsers ?? []);
      setCurrentUserId(msgData.currentUserId ?? "");
      if (!selectedCa && caData.caUsers?.length > 0) {
        setSelectedCa(caData.caUsers[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const threadMessages = selectedCa
    ? messages.filter(
        (m) =>
          (m.sender.id === selectedCa && m.receiver.id === currentUserId) ||
          (m.sender.id === currentUserId && m.receiver.id === selectedCa)
      )
    : [];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !selectedCa) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: selectedCa, content, subject }),
      });
      if (res.ok) {
        setContent("");
        setSubject("");
        load();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-container animate-fade-in" style={{ height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="section-title">Messages</h1>
        <p className="section-subtitle">Direct communication with your CA</p>
      </div>

      {loading ? (
        <div className="section-card" style={{ flex: 1 }}>
          <div className="empty-state">
            <div className="loading-spinner" />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading messages...</p>
          </div>
        </div>
      ) : caUsers.length === 0 ? (
        <div className="section-card" style={{ flex: 1 }}>
          <div className="empty-state">
            <UserCog size={48} color="var(--text-muted)" />
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No CA assigned</p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: 300, textAlign: "center" }}>
              You'll be able to message your CA once they're assigned to your account.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 0, flex: 1, minHeight: 0, border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          {/* CA list */}
          <div
            style={{
              background: "var(--bg-elevated)",
              borderRight: "1px solid var(--border)",
              overflowY: "auto",
              padding: "16px 0",
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", padding: "0 16px", marginBottom: 8 }}>
              Your CAs
            </p>
            {caUsers.map((ca) => {
              const unread = messages.filter(
                (m) => m.sender.id === ca.id && !m.isRead
              ).length;
              return (
                <button
                  key={ca.id}
                  onClick={() => setSelectedCa(ca.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: selectedCa === ca.id ? "rgba(99,102,241,0.1)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    borderLeft: selectedCa === ca.id ? "3px solid #6366f1" : "3px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(14,165,233,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0ea5e9",
                      flexShrink: 0,
                    }}
                  >
                    {(ca.name ?? ca.email).charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ca.name ?? ca.email}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Chartered Accountant</p>
                  </div>
                  {unread > 0 && (
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#6366f1",
                        color: "white",
                        fontSize: 10,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Thread */}
          <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-surface)" }}>
            {/* Thread header */}
            {selectedCa && (
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {(() => {
                  const ca = caUsers.find((c) => c.id === selectedCa);
                  return ca ? (
                    <>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "rgba(14,165,233,0.15)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#0ea5e9",
                        }}
                      >
                        {(ca.name ?? ca.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                          {ca.name ?? ca.email}
                        </p>
                        <p style={{ fontSize: 11, color: "#10b981" }}>● Online</p>
                      </div>
                    </>
                  ) : null;
                })()}
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {threadMessages.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                  }}
                >
                  <MessageSquare size={36} color="var(--text-muted)" />
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>No messages yet. Start a conversation.</p>
                </div>
              ) : (
                threadMessages.map((msg) => {
                  const isOwnMessage = msg.sender.id === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        justifyContent: isOwnMessage ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "70%",
                          padding: "10px 14px",
                          borderRadius: isOwnMessage ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          background: isOwnMessage ? "#6366f1" : "var(--bg-elevated)",
                          border: isOwnMessage ? "none" : "1px solid var(--border)",
                        }}
                      >
                        {msg.subject && (
                          <p style={{ fontSize: 11, fontWeight: 700, color: isOwnMessage ? "rgba(255,255,255,0.8)" : "var(--text-muted)", marginBottom: 4 }}>
                            {msg.subject}
                          </p>
                        )}
                        <p style={{ fontSize: 13, color: isOwnMessage ? "white" : "var(--text-primary)", lineHeight: 1.5 }}>
                          {msg.content}
                        </p>
                        <p style={{ fontSize: 10, color: isOwnMessage ? "rgba(255,255,255,0.6)" : "var(--text-muted)", marginTop: 4, textAlign: "right" }}>
                          {format(new Date(msg.createdAt), "dd MMM · HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <form
              onSubmit={handleSend}
              style={{
                padding: "16px 20px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject (optional)"
                style={{
                  padding: "8px 12px",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Type a message..."
                  rows={2}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 13,
                    color: "var(--text-primary)",
                    outline: "none",
                    resize: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e as unknown as React.FormEvent);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !content.trim()}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: content.trim() ? "#6366f1" : "var(--bg-elevated)",
                    border: "none",
                    cursor: content.trim() ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    alignSelf: "flex-end",
                    transition: "background 0.15s ease",
                  }}
                >
                  <Send size={16} color={content.trim() ? "white" : "var(--text-muted)"} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
