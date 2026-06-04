import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

interface AppPageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  maxWidth?: number | string;
  padding?: number | string;
}

/**
 * Standard page wrapper. Wraps PageHeader + content with consistent
 * padding and max-width. Use for 90% of pages.
 */
export function AppPage({
  title,
  description,
  actions,
  breadcrumb,
  badge,
  children,
  maxWidth,
  padding = "0 0 40px",
}: AppPageProps) {
  return (
    <div style={{ padding, maxWidth, margin: maxWidth ? "0 auto" : undefined }}>
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        breadcrumb={breadcrumb}
        badge={badge}
      />
      {children}
    </div>
  );
}
