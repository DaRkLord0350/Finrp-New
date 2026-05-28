// ============================================================
// /integrations — Connector Dashboard
// Shows all active and available integrations with status cards.
// ============================================================

import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import {
  Plus,
  Plug,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react";
import type { Integration, IntegrationStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Available connector definitions (for "add new" cards)
// ---------------------------------------------------------------------------

const AVAILABLE_CONNECTORS = [
  {
    type: "ZOHO_CRM" as const,
    name: "Zoho CRM",
    description: "Sync contacts, leads, and deals from Zoho CRM",
    logo: "/logos/zoho.svg",
    docsUrl: "/integrations/zoho",
  },
  {
    type: "ZOHO_BOOKS" as const,
    name: "Zoho Books",
    description: "Import invoices, bills, and financial data from Zoho Books",
    logo: "/logos/zoho.svg",
    docsUrl: "/integrations/zoho",
  },
  {
    type: "TALLY" as const,
    name: "Tally Prime",
    description: "Connect Tally ERP for ledger, voucher, and inventory sync",
    logo: "/logos/tally.svg",
    docsUrl: "/integrations/tally",
  },
  {
    type: "ODOO" as const,
    name: "Odoo",
    description: "Sync partners, invoices, and products from Odoo instances",
    logo: "/logos/odoo.svg",
    docsUrl: "/integrations/odoo",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: IntegrationStatus) {
  const map: Record<IntegrationStatus, { label: string; icon: React.FC<{ className?: string }>; className: string }> = {
    ACTIVE: { label: "Connected", icon: CheckCircle2, className: "text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30" },
    INACTIVE: { label: "Not connected", icon: XCircle, className: "text-muted-foreground" },
    EXPIRED: { label: "Token expired", icon: AlertCircle, className: "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30" },
    ERROR: { label: "Error", icon: AlertCircle, className: "text-destructive border-destructive/30" },
    SYNCING: { label: "Syncing", icon: RefreshCw, className: "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/30" },
    PENDING_AUTH: { label: "Auth pending", icon: Clock, className: "text-amber-600 border-amber-200 bg-amber-50" },
  };

  const { label, icon: Icon, className } = map[status] ?? map.INACTIVE;

  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Integration Card
// ---------------------------------------------------------------------------

function IntegrationCard({ integration }: { integration: Integration }) {
  const def = AVAILABLE_CONNECTORS.find((c) => c.type === integration.type);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Plug className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">{integration.name}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {def?.description ?? integration.type}
            </CardDescription>
          </div>
        </div>
        {statusBadge(integration.status)}
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {integration.lastSyncAt
              ? `Last synced ${new Date(integration.lastSyncAt).toLocaleDateString()}`
              : "Never synced"}
          </div>
          <div className="flex gap-2">
            <Link href={`/integrations/${integration.id}`}>
              <Button variant="outline" size="sm">
                Manage
              </Button>
            </Link>
            {integration.status === "ACTIVE" && (
              <form action={`/api/integrations/${integration.id}/sync`} method="POST">
                <Button type="submit" size="sm" variant="ghost">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

async function IntegrationsContent() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getCurrentUser();

  const integrations = await (prisma as any).integration.findMany({
    where: { organizationId: user.organizationId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const connectedTypes = new Set(integrations.map((i: Integration) => i.type));
  const availableToAdd = AVAILABLE_CONNECTORS.filter((c) => !connectedTypes.has(c.type));

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect external systems to sync your data automatically.
          </p>
        </div>
      </div>

      {/* Active integrations */}
      {integrations.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Connected ({integrations.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration: Integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </section>
      )}

      {/* Available connectors */}
      {availableToAdd.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
            Available Connectors
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableToAdd.map((connector) => (
              <Card key={connector.type} className="border-dashed hover:border-primary/50 transition-colors cursor-pointer group">
                <Link href={connector.docsUrl}>
                  <CardHeader className="flex flex-row items-start gap-3 pb-2">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{connector.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {connector.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <span className="text-xs text-primary font-medium group-hover:underline">
                      Connect →
                    </span>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      {integrations.length === 0 && availableToAdd.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Plug className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No integrations available</p>
        </div>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse space-y-4 p-8">
      {[1,2,3].map((i) => <div key={i} className="h-32 bg-muted rounded-xl" />)}
    </div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
