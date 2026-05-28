import React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Simple Card (legacy default export — kept for backward compat)
// ---------------------------------------------------------------------------
interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

const CardDefault: React.FC<CardProps> = ({
  children,
  className = "",
  as: Component = "div",
}) => {
  return (
    <Component
      className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 sm:p-6 transition-all duration-300 hover:shadow-lg dark:hover:shadow-slate-700/50 ${className}`}
    >
      {children}
    </Component>
  );
};

export default React.memo(CardDefault);

// ---------------------------------------------------------------------------
// shadcn/ui-style named exports (used by new import/integration UI)
// ---------------------------------------------------------------------------

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-6", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-base font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-6 pt-0", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
