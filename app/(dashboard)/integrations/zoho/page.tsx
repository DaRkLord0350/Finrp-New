"use client";

// ============================================================
// /integrations/zoho — Zoho Setup + OAuth Connect
// ============================================================

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ArrowLeft, ExternalLink, Plug } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const DATA_CENTERS = [
  { value: "IN", label: "India (zoho.in)" },
  { value: "US", label: "United States (zoho.com)" },
  { value: "EU", label: "Europe (zoho.eu)" },
  { value: "AU", label: "Australia (zoho.com.au)" },
  { value: "JP", label: "Japan (zoho.jp)" },
];

const ZOHO_MODULES = [
  { type: "ZOHO_CRM", label: "Zoho CRM", description: "Contacts, leads, accounts, deals" },
  { type: "ZOHO_BOOKS", label: "Zoho Books", description: "Invoices, bills, payments, expenses" },
  { type: "ZOHO_INVENTORY", label: "Zoho Inventory", description: "Items, stock, purchase orders" },
];

interface ZohoIntegration {
  id: string;
  type: string;
  status: string;
  name: string;
  lastSyncAt: string | null;
}

export default function ZohoIntegrationPage() {
  const searchParams = useSearchParams();
  const isConnected = searchParams.get("connected") === "true";
  const errorParam = searchParams.get("error");

  const [integrations, setIntegrations] = useState<ZohoIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataCenter, setDataCenter] = useState("IN");
  const [integrationName, setIntegrationName] = useState("Zoho CRM");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const all = await res.json() as ZohoIntegration[];
        setIntegrations(all.filter((i) => i.type.startsWith("ZOHO")));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function createAndConnect(type: string) {
    setIsCreating(true);
    try {
      // Create integration record
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: integrationName || type.replace("ZOHO_", "Zoho "),
          config: { dataCenter },
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        // If already exists, get the existing one
        if (res.status === 409) {
          const all = await fetch("/api/integrations").then((r) => r.json()) as ZohoIntegration[];
          const existing = all.find((i: ZohoIntegration) => i.type === type);
          if (existing) {
            window.location.href = `/api/oauth/zoho?integrationId=${existing.id}&dataCenter=${dataCenter}`;
            return;
          }
        }
        throw new Error(err.error ?? "Failed to create integration");
      }

      const integration = await res.json() as ZohoIntegration;

      // Redirect to Zoho OAuth
      window.location.href = `/api/oauth/zoho?integrationId=${integration.id}&dataCenter=${dataCenter}`;
    } catch (err) {
      console.error("Failed to connect:", err);
      alert(err instanceof Error ? err.message : "Failed to connect to Zoho");
    } finally {
      setIsCreating(false);
    }
  }

  async function triggerSync(integrationId: string) {
    await fetch(`/api/integrations/${integrationId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "all", isIncremental: true }),
    });
    fetchIntegrations();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/integrations">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
            <Plug className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Zoho Integration</h1>
            <p className="text-sm text-muted-foreground">Connect Zoho CRM, Books, and Inventory</p>
          </div>
        </div>
      </div>

      {/* Success / Error banners */}
      {isConnected && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            Successfully connected to Zoho! Your data will sync in the background.
          </AlertDescription>
        </Alert>
      )}

      {errorParam && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Connection failed: {decodeURIComponent(errorParam)}
          </AlertDescription>
        </Alert>
      )}

      {/* Connected integrations */}
      {!isLoading && integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connected Modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={integration.status === "ACTIVE"
                      ? "text-green-600 border-green-200 bg-green-50"
                      : "text-muted-foreground"
                    }
                  >
                    {integration.status}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {integration.lastSyncAt
                        ? `Last sync: ${new Date(integration.lastSyncAt).toLocaleString()}`
                        : "Never synced"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => triggerSync(integration.id)}
                  >
                    Sync Now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => createAndConnect(integration.type)}
                  >
                    Reconnect
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Setup form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect Zoho</CardTitle>
          <CardDescription>
            You'll be redirected to Zoho to grant access. Make sure you have admin
            permissions in your Zoho account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data center */}
          <div className="space-y-2">
            <Label>Zoho Data Center</Label>
            <Select value={dataCenter} onValueChange={setDataCenter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATA_CENTERS.map((dc) => (
                  <SelectItem key={dc.value} value={dc.value}>
                    {dc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the data center where your Zoho account is hosted.
              Indian accounts use zoho.in.
            </p>
          </div>

          <Separator />

          {/* Module cards */}
          <div className="space-y-2">
            <Label>Select Module to Connect</Label>
            <div className="space-y-2">
              {ZOHO_MODULES.map((module) => {
                const isAlreadyConnected = integrations.some((i) => i.type === module.type);
                return (
                  <div
                    key={module.type}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium">{module.label}</p>
                      <p className="text-xs text-muted-foreground">{module.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={isAlreadyConnected ? "outline" : "default"}
                      disabled={isCreating}
                      onClick={() => createAndConnect(module.type)}
                    >
                      {isAlreadyConnected ? "Reconnect" : "Connect"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Docs link */}
          <a
            href="https://www.zoho.com/crm/developer/docs/api/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Zoho API Documentation
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
