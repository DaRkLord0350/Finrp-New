"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Building2,
  Upload,
  FileCheck,
  Users,
  Bell,
  Shield,
  ChevronRight,
  Plug,
  FileSpreadsheet,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNav = [
  {
    group: "Account",
    items: [
      { label: "Profile", href: "/settings/profile", icon: User, description: "Your personal info" },
      { label: "Security", href: "/settings/security", icon: Shield, description: "Passwords & API keys" },
    ],
  },
  {
    group: "Organization",
    items: [
      { label: "Organization", href: "/settings/organization", icon: Building2, description: "Company details" },
      { label: "Invoice Appearance", href: "/settings/invoice-appearance", icon: Palette, description: "Branding & PDF style" },
      { label: "Users & Roles", href: "/settings/users", icon: Users, description: "Team management" },
      { label: "Notifications", href: "/settings/notifications", icon: Bell, description: "Alert preferences" },
    ],
  },
  {
    group: "Data",
    items: [
      { label: "Import Center", href: "/settings/imports", icon: Upload, description: "Bulk import CSV & Excel" },
      { label: "Compliance Docs", href: "/settings/compliance", icon: FileCheck, description: "Document center" },
    ],
  },
  {
    group: "Integrations",
    items: [
      { label: "All Integrations", href: "/integrations", icon: Plug, description: "Connect external systems" },
      { label: "CSV Import", href: "/integrations/csv", icon: FileSpreadsheet, description: "Import from spreadsheets" },
    ],
  },
];

export default function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border)",
        padding: "24px 12px",
        minHeight: "calc(100vh - 57px)",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {settingsNav.map((group) => (
        <div key={group.group}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              padding: "0 10px",
              marginBottom: 6,
            }}
          >
            {group.group}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("sidebar-nav-item", isActive && "active")}
                  style={{ gap: 10 }}
                >
                  <Icon size={15} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                  {isActive && (
                    <ChevronRight
                      size={11}
                      style={{ marginLeft: "auto", opacity: 0.5 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
