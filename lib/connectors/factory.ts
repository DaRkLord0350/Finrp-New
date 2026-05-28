// ============================================================
// FinRP — Connector Factory
// Maps ConnectorType enum → concrete connector instance.
// Reads integration config from DB + decrypts credentials.
// ============================================================

import type { ConnectorType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto/token-encryption";
import { ZohoConnector } from "./zoho";
import { TallyConnector } from "./tally";
import { OdooConnector } from "./odoo";
import type { ZohoConfig, TallyConfig, OdooConfig, CsvConfig } from "./base/types";
import type { BaseConnector } from "./base/connector";

// ---------------------------------------------------------------------------
// Encrypted field shape stored in Integration.config (Prisma JSON)
// ---------------------------------------------------------------------------

interface ZohoStoredConfig {
  dataCenter: string;
  clientId: string;
  clientSecretEncrypted: string;
  accountId?: string;
}

interface OdooStoredConfig {
  baseUrl: string;
  database: string;
  username: string;
  passwordEncrypted: string;
}

interface TallyStoredConfig {
  /** Mutual exclusion: bridge OR host/port */
  bridgeUrl?: string;
  bridgeApiKeyEncrypted?: string;
  host?: string;
  port?: number;
  companyName?: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createConnector(
  integrationId: string,
  organizationId: string
): Promise<BaseConnector> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    select: {
      id: true,
      type: true,
      config: true,
      organizationId: true,
    },
  });

  if (!integration) {
    throw new Error(`Integration ${integrationId} not found`);
  }

  if (integration.organizationId !== organizationId) {
    throw new Error("Integration does not belong to this organization");
  }

  const config = integration.config as Record<string, unknown>;

  switch (integration.type as ConnectorType) {
    case "ZOHO_CRM":
    case "ZOHO_BOOKS":
    case "ZOHO_INVENTORY":
      return createZohoConnector(organizationId, integrationId, config);

    case "ODOO":
      return createOdooConnector(organizationId, config);

    case "TALLY":
      return createTallyConnector(organizationId, config);

    case "CSV":
    case "EXCEL":
      throw new Error(
        `${integration.type} connectors are file-based. Use parseCSVFile / parseExcelFile directly.`
      );

    default:
      throw new Error(`Unsupported connector type: ${integration.type}`);
  }
}

// ---------------------------------------------------------------------------
// Per-connector constructors (decrypt sensitive fields here)
// ---------------------------------------------------------------------------

function createZohoConnector(
  organizationId: string,
  integrationId: string,
  raw: Record<string, unknown>
): ZohoConnector {
  const stored = raw as unknown as ZohoStoredConfig;

  const config: ZohoConfig = {
    dataCenter: (stored.dataCenter?.toUpperCase() as ZohoConfig["dataCenter"]) ?? "US",
    clientId: stored.clientId,
    clientSecret: decrypt(stored.clientSecretEncrypted),
    accountId: stored.accountId,
  };

  return new ZohoConnector(organizationId, integrationId, config);
}

function createOdooConnector(
  organizationId: string,
  raw: Record<string, unknown>
): OdooConnector {
  const stored = raw as unknown as OdooStoredConfig;

  const config: OdooConfig = {
    baseUrl: stored.baseUrl,
    database: stored.database,
    username: stored.username,
    password: decrypt(stored.passwordEncrypted),
  };

  return new OdooConnector(organizationId, config);
}

function createTallyConnector(
  organizationId: string,
  raw: Record<string, unknown>
): TallyConnector {
  const stored = raw as unknown as TallyStoredConfig;

  const config: TallyConfig = {
    bridgeUrl: stored.bridgeUrl,
    bridgeApiKey: stored.bridgeApiKeyEncrypted
      ? decrypt(stored.bridgeApiKeyEncrypted)
      : undefined,
    host: stored.host,
    port: stored.port,
    companyName: stored.companyName,
  };

  return new TallyConnector(organizationId, config);
}

// ---------------------------------------------------------------------------
// Type-guard utility for callers that want a strongly-typed connector
// ---------------------------------------------------------------------------

export function assertConnectorType<T extends BaseConnector>(
  connector: BaseConnector,
  type: string
): asserts connector is T {
  if ((connector as { type?: string }).type !== type) {
    throw new Error(
      `Expected connector type ${type}, got ${(connector as { type?: string }).type}`
    );
  }
}
