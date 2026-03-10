"use client";

import { motion } from "framer-motion";
import {
  DollarSign,
  Users,
  FileText,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import RevenueChart from "@/components/RevenueChart";

const stats = [
  {
    title: "Total Revenue",
    value: "$51,200",
    change: 13.2,
    changeLabel: "vs last month",
    icon: DollarSign,
    iconColor: "#6366f1",
  },
  {
    title: "Active Customers",
    value: "124",
    change: 8.1,
    changeLabel: "vs last month",
    icon: Users,
    iconColor: "#10b981",
  },
  {
    title: "Invoices Sent",
    value: "39",
    change: 14.7,
    changeLabel: "this month",
    icon: FileText,
    iconColor: "#3b82f6",
  },
  {
    title: "Overdue",
    value: "5",
    change: -2,
    changeLabel: "vs last month",
    icon: AlertTriangle,
    iconColor: "#f59e0b",
  },
];

const recentInvoices = [
  { id: "INV-00039", customer: "Acme Corp", amount: "$8,400", status: "PAID", date: "Mar 8" },
  { id: "INV-00038", customer: "TechFlow Ltd", amount: "$3,200", status: "SENT", date: "Mar 7" },
  { id: "INV-00037", customer: "BrightStar Inc", amount: "$5,800", status: "OVERDUE", date: "Mar 1" },
  { id: "INV-00036", customer: "Quantum Media", amount: "$1,900", status: "PAID", date: "Feb 28" },
  { id: "INV-00035", customer: "NovaBuild Co", amount: "$12,100", status: "SENT", date: "Feb 26" },
];

const quickActions = [
  { label: "New Invoice", href: "/billing/new", icon: FileText, color: "#6366f1" },
  { label: "Add Customer", href: "/crm", icon: Users, color: "#10b981" },
  { label: "View Analytics", href: "/finance", icon: TrendingUp, color: "#3b82f6" },
  { label: "Compliance", href: "/compliance", icon: ShieldCheck, color: "#f59e0b" },
];

const complianceTasks = [
  { title: "Q1 GST Filing", due: "Mar 31", status: "PENDING" },
  { title: "Annual Tax Return", due: "Apr 15", status: "IN_PROGRESS" },
  { title: "Business License Renewal", due: "May 1", status: "PENDING" },
];

const statusColors: Record<string, string> = {
  PAID: "bg-emerald-500/20 text-emerald-400",
  SENT: "bg-blue-500/20 text-blue-400",
  OVERDUE: "bg-red-500/20 text-red-400",
  DRAFT: "bg-zinc-500/20 text-zinc-400",
  PENDING: "bg-amber-500/20 text-amber-400",
  IN_PROGRESS: "bg-blue-500/20 text-blue-400",
  COMPLETED: "bg-emerald-500/20 text-emerald-400",
};

export default function DashboardPage() {
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          Good morning 👋
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
          Here's what's happening with your business today.
        </p>
      </div>

      {/* Stats Grid */}
      <div
        className="stagger"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {stats.map((stat, i) => (
          <StatCard key={stat.title} {...stat} index={i} />
        ))}
      </div>

      {/* Main content grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Revenue Chart */}
        <RevenueChart />

        {/* Quick Actions */}
        <motion.div
          className="surface"
          style={{ padding: 20 }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <h3 className="section-title" style={{ marginBottom: 16 }}>
            Quick Actions
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: "var(--text-secondary)",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor =
                      "var(--border-strong)";
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor =
                      "var(--border)";
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      "var(--text-secondary)";
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: `${action.color}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={15} color={action.color} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {action.label}
                  </span>
                  <ArrowRight
                    size={14}
                    style={{ marginLeft: "auto", opacity: 0.5 }}
                  />
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Bottom grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 20,
        }}
      >
        {/* Recent Invoices */}
        <motion.div
          className="surface"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h3 className="section-title">Recent Invoices</h3>
            <Link
              href="/billing"
              style={{
                fontSize: 12,
                color: "#818cf8",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((inv) => (
                <tr key={inv.id} style={{ cursor: "pointer" }}>
                  <td style={{ fontFamily: "monospace", color: "var(--text-primary)", fontSize: 13 }}>
                    {inv.id}
                  </td>
                  <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {inv.customer}
                  </td>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {inv.amount}
                  </td>
                  <td>
                    <span
                      className={`badge ${statusColors[inv.status] || ""}`}
                      style={{ border: "none", fontSize: 10 }}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{inv.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Compliance Tasks */}
        <motion.div
          className="surface"
          style={{ padding: 0, overflow: "hidden" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 20px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h3 className="section-title">Compliance</h3>
            <Link
              href="/compliance"
              style={{
                fontSize: 12,
                color: "#818cf8",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {complianceTasks.map((task) => (
              <div
                key={task.title}
                style={{
                  padding: "12px 14px",
                  background: "var(--bg-elevated)",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background:
                      task.status === "IN_PROGRESS"
                        ? "rgba(59,130,246,0.15)"
                        : "rgba(245,158,11,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {task.status === "IN_PROGRESS" ? (
                    <Clock size={13} color="#3b82f6" />
                  ) : (
                    <ShieldCheck size={13} color="#f59e0b" />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {task.title}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    Due {task.due}
                  </p>
                </div>
                <span
                  className={`badge ${statusColors[task.status] || ""}`}
                  style={{ border: "none", fontSize: 10 }}
                >
                  {task.status.replace("_", " ")}
                </span>
              </div>
            ))}

            <Link
              href="/compliance"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px dashed var(--border)",
                color: "var(--text-muted)",
                fontSize: 13,
                textDecoration: "none",
                marginTop: 4,
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={14} />
              Add compliance task
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
