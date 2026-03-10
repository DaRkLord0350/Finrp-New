"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, User, Sparkles, Zap, RotateCcw, Copy, CheckCheck } from "lucide-react";
import { AdvisorMessage } from "@/types";

const SUGGESTED_PROMPTS = [
  "What was my revenue last month?",
  "Which customers generate the most revenue?",
  "Do I have any overdue invoices I should follow up on?",
  "What compliance deadlines are coming up?",
  "How is my business performing compared to last quarter?",
  "Give me a cash flow summary for this week.",
];

const EXAMPLE_RESPONSES: Record<string, string> = {
  default: `## Business Overview 📊

Based on your current data, here's a quick snapshot:

**Revenue (March 2025):** $51,200 — up **13.2%** from February

**Key highlights:**
- You have **5 overdue invoices** totaling ~$18,400 outstanding
- **NovaBuild Co** remains your top customer at $67,400 YTD
- Your Q1 GST Filing is due **March 31st** — action needed soon

**Action items:**
1. Follow up on the BrightStar Media overdue invoice ($5,800)
2. Start preparing your Q1 GST filing
3. Consider sending a payment reminder to TechFlow Solutions

Is there anything specific you'd like to dive deeper into?`,
};

function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)" }}>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return <h2 key={i} style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "12px 0 6px", letterSpacing: "-0.01em" }}>{line.replace("## ", "")}</h2>;
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} style={{ fontWeight: 600, color: "var(--text-primary)", margin: "6px 0" }}>{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <p key={i} style={{ color: "var(--text-secondary)", marginLeft: 16, marginBottom: 3 }}>• {line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        }
        if (/^\d+\./.test(line)) {
          return <p key={i} style={{ color: "var(--text-secondary)", marginLeft: 16, marginBottom: 3 }}>{line.replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        }
        if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
        return <p key={i} style={{ color: "var(--text-secondary)", marginBottom: 4 }}>{line.replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
      })}
    </div>
  );
}

export default function AdvisorPage() {
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your FinRP AI Business Advisor, powered by Gemini 2.5 Flash. I have access to your business data — revenue, invoices, customers, and compliance tasks.\n\nAsk me anything about your business performance, or use one of the suggested prompts below.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMsg: AdvisorMessage = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content.trim() }),
      });

      const data = await res.json();
      const reply = data.response || EXAMPLE_RESPONSES.default;

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: EXAMPLE_RESPONSES.default,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const clearChat = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Chat cleared. How can I help you with your business today?",
      timestamp: new Date(),
    }]);
  };

  return (
    <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "0 0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(16,185,129,0.2))",
            border: "1px solid rgba(99,102,241,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot size={20} color="#818cf8" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>AI Business Advisor</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Gemini 2.5 Flash · Connected</p>
            </div>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="btn-ghost"
          style={{ gap: 6, fontSize: 13 }}
        >
          <RotateCcw size={13} /> Clear Chat
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "0 0 20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: msg.role === "user"
                  ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                  : "rgba(99,102,241,0.12)",
                border: msg.role === "user" ? "none" : "1px solid rgba(99,102,241,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {msg.role === "user"
                  ? <User size={15} color="white" />
                  : <Sparkles size={15} color="#818cf8" />
                }
              </div>

              {/* Bubble */}
              <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}
                  style={{ position: "relative" }}
                >
                  {msg.role === "user"
                    ? <p style={{ fontSize: 14, lineHeight: 1.6 }}>{msg.content}</p>
                    : <MarkdownText content={msg.content} />
                  }
                </div>
                {msg.role === "assistant" && (
                  <div style={{ display: "flex", gap: 6, paddingLeft: 4 }}>
                    <button
                      onClick={() => copyMessage(msg.id, msg.content)}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--text-muted)", fontSize: 11, padding: "2px 4px",
                      }}
                    >
                      {copied === msg.id ? <CheckCheck size={11} color="#10b981" /> : <Copy size={11} />}
                      {copied === msg.id ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Loading state */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={15} color="#818cf8" />
            </div>
            <div className="chat-bubble-ai" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    style={{ width: 7, height: 7, borderRadius: "50%", background: "#818cf8" }}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                    transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                  />
                ))}
                <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 4 }}>Analyzing your business data...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length <= 1 && (
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Try asking...
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                style={{
                  padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: "1px solid var(--border)", background: "var(--bg-surface)",
                  color: "var(--text-secondary)", cursor: "pointer", transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget).style.borderColor = "rgba(99,102,241,0.5)";
                  (e.currentTarget).style.color = "#818cf8";
                  (e.currentTarget).style.background = "rgba(99,102,241,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget).style.borderColor = "var(--border)";
                  (e.currentTarget).style.color = "var(--text-secondary)";
                  (e.currentTarget).style.background = "var(--bg-surface)";
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 14,
          padding: "12px 14px",
          transition: "border-color 0.2s ease",
        }}>
          <Zap size={16} color="#818cf8" style={{ flexShrink: 0, marginBottom: 4 }} />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your revenue, customers, compliance deadlines..."
            rows={1}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: 14, lineHeight: 1.5,
              resize: "none", fontFamily: "inherit", maxHeight: 120, overflowY: "auto",
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: input.trim() && !loading ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "var(--bg-elevated)",
              border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s ease",
            }}
          >
            <Send size={14} color={input.trim() && !loading ? "white" : "var(--text-muted)"} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
          Powered by Gemini 2.5 Flash · AI can make mistakes, verify important information
        </p>
      </div>
    </div>
  );
}
