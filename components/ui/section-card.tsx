import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: number | string;
}

export function SectionCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
  padding = 24,
}: SectionCardProps) {
  return (
    <div
      className={cn(className)}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding,
        marginBottom: 24,
      }}
    >
      {(title || actions) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {icon && <span style={{ color: "#6366f1" }}>{icon}</span>}
            <div>
              {title && <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h2>}
              {description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{description}</p>}
            </div>
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
