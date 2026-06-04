import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Show a divider above this section */
  divider?: boolean;
}

/**
 * Standard form section with a title and optional description.
 * Used in settings pages, onboarding forms, etc.
 */
export function FormSection({ title, description, children, divider }: FormSectionProps) {
  return (
    <div>
      {divider && (
        <div style={{ height: 1, background: "var(--border)", margin: "28px 0" }} />
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 32,
          alignItems: "start",
        }}
      >
        {/* Left: description */}
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 5,
            }}
          >
            {title}
          </h3>
          {description && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {description}
            </p>
          )}
        </div>

        {/* Right: form fields */}
        <div className="surface" style={{ padding: 24 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
