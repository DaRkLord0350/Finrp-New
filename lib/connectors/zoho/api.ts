// ============================================================
// FinRP — Zoho API Client
// Typed wrappers around Zoho CRM, Books, and Inventory APIs.
// Auto-refreshes tokens; handles pagination; normalises errors.
// ============================================================

import { getValidAccessToken, getApiBaseUrl } from "./oauth";

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------
interface ZohoFetchOptions {
  integrationId: string;
  dataCenter: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;             // e.g. "/crm/v7/Contacts"
  params?: Record<string, string | number>;
  body?: unknown;
}

interface ZohoApiResponse<T = unknown> {
  data?: T[];
  info?: { count: number; more_records: boolean; page: number; per_page: number };
  code?: string;
  details?: unknown;
  message?: string;
  status?: string;
}

async function zohoFetch<T = unknown>(opts: ZohoFetchOptions): Promise<ZohoApiResponse<T>> {
  const { integrationId, dataCenter, method = "GET", path, params, body } = opts;
  const token = await getValidAccessToken(integrationId);
  const base = getApiBaseUrl(dataCenter);

  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    throw new Error("ZOHO_UNAUTHORIZED: Token invalid or expired");
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Zoho API error ${res.status}: ${errText}`);
  }

  return res.json() as Promise<ZohoApiResponse<T>>;
}

// ---------------------------------------------------------------------------
// CRM — Contacts (mapped to Customers)
// ---------------------------------------------------------------------------
export interface ZohoCRMContact {
  id: string;
  First_Name?: string;
  Last_Name: string;
  Email?: string;
  Phone?: string;
  Account_Name?: { name?: string };
  Mailing_Street?: string;
  Mailing_City?: string;
  Mailing_State?: string;
  Mailing_Country?: string;
  GSTIN?: string;
  Modified_Time: string;
  Created_Time: string;
}

export async function fetchCRMContacts(params: {
  integrationId: string;
  dataCenter: string;
  page?: number;
  perPage?: number;
  modifiedAfter?: string;
}): Promise<{ contacts: ZohoCRMContact[]; hasMore: boolean; nextPage: number }> {
  const { integrationId, dataCenter, page = 1, perPage = 200, modifiedAfter } = params;

  console.log("[ZOHO] fetchCRMContacts called");
  console.log("[ZOHO] fetchCRMContacts", {
    page,
    perPage,
    modifiedAfter,
  });
  const queryParams: Record<string, string | number> = {
    page,
    per_page: perPage,
    sort_by: "Modified_Time",
    sort_order: "asc",
    fields:"id,First_Name,Last_Name,Email,Phone,Account_Name,Mailing_Street,Mailing_City,Mailing_State,Mailing_Country,Modified_Time,Created_Time",
};

  if (modifiedAfter) {
    queryParams.if_modified_since = modifiedAfter;
  }

  const resp = await zohoFetch<ZohoCRMContact>({
    integrationId,
    dataCenter,
    path: "/crm/v7/Contacts",
    params: queryParams,
  });
  console.log("[ZOHO] CRM response", {
      records: resp.data?.length ?? 0,
      hasMore: resp.info?.more_records,
    });

  return {
    contacts: resp.data ?? [],
    hasMore: resp.info?.more_records ?? false,
    nextPage: (resp.info?.page ?? page) + 1,
  };
}

// Fetch all contacts with pagination
export async function fetchAllCRMContacts(params: {
  integrationId: string;
  dataCenter: string;
  modifiedAfter?: string;
  onPage?: (contacts: ZohoCRMContact[], page: number) => void;
}): Promise<ZohoCRMContact[]> {
  const all: ZohoCRMContact[] = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const result = await fetchCRMContacts({ ...params, page });
    all.push(...result.contacts);
    params.onPage?.(result.contacts, page);
    hasMore = result.hasMore;
    page = result.nextPage;
    console.log("[ZOHO] Page fetched", {
      page,
      contacts: result.contacts.length,
    });
    
    
    if (!hasMore) break;
    await delay(200); // Rate limit: 200ms between pages
  }

  return all;
}

// ---------------------------------------------------------------------------
// Books — Contacts (Customers/Vendors)
// ---------------------------------------------------------------------------
export interface ZohoBooksContact {
  contact_id: string;
  contact_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  gst_no?: string;
  contact_type: "customer" | "vendor";
  billing_address?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  last_modified_time: string;
}

export async function fetchBooksContacts(params: {
  integrationId: string;
  dataCenter: string;
  accountId: string;
  page?: number;
  contactType?: "customer" | "vendor";
  modifiedAfter?: string;
}): Promise<{ contacts: ZohoBooksContact[]; hasMore: boolean }> {
  const { integrationId, dataCenter, accountId, page = 1, contactType, modifiedAfter } = params;

  const queryParams: Record<string, string | number> = {
    organization_id: accountId,
    page,
    per_page: 200,
    sort_column: "last_modified_time",
    sort_order: "A",
  };

  if (contactType) queryParams.contact_type = contactType;
  if (modifiedAfter) queryParams.last_modified_time_start = modifiedAfter;

  const resp = await zohoFetch<{ contacts: ZohoBooksContact[]; page_context?: { has_more_page?: boolean } }>({
    integrationId,
    dataCenter,
    path: "/books/v3/contacts",
    params: queryParams,
  });

  const rawData = resp as unknown as { contacts?: ZohoBooksContact[]; page_context?: { has_more_page?: boolean } };
  return {
    contacts: rawData.contacts ?? [],
    hasMore: rawData.page_context?.has_more_page ?? false,
  };
}

// ---------------------------------------------------------------------------
// Books — Invoices
// ---------------------------------------------------------------------------
export interface ZohoBooksInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  status: string;
  date: string;          // YYYY-MM-DD
  due_date: string;
  sub_total: number;
  tax_total: number;
  total: number;
  balance: number;
  currency_code: string;
  line_items?: {
    description: string;
    quantity: number;
    rate: number;
    tax_percentage?: number;
    item_total: number;
  }[];
  last_modified_time: string;
}

export async function fetchBooksInvoices(params: {
  integrationId: string;
  dataCenter: string;
  accountId: string;
  page?: number;
  modifiedAfter?: string;
  status?: string;
}): Promise<{ invoices: ZohoBooksInvoice[]; hasMore: boolean }> {
  const { integrationId, dataCenter, accountId, page = 1, modifiedAfter, status } = params;
  console.log({
    accountId,
    endpoint: "/books/v3/invoices",
  });
  const queryParams: Record<string, string | number> = {
    organization_id: accountId,
    page,
    per_page: 200,
    sort_column: "last_modified_time",
    sort_order: "A",
  };

  if (modifiedAfter) queryParams.last_modified_time_start = modifiedAfter;
  if (status) queryParams.status = status;

  const resp = await zohoFetch<unknown>({
    integrationId,
    dataCenter,
    path: "/books/v3/invoices",
    params: queryParams,
  });

  const rawData = resp as unknown as { invoices?: ZohoBooksInvoice[]; page_context?: { has_more_page?: boolean } };
  return {
    invoices: rawData.invoices ?? [],
    hasMore: rawData.page_context?.has_more_page ?? false,
  };
}

// ---------------------------------------------------------------------------
// Inventory — Items / Products
// ---------------------------------------------------------------------------
export interface ZohoInventoryItem {
  item_id: string;
  name: string;
  sku?: string;
  description?: string;
  category_name?: string;
  unit?: string;
  purchase_rate?: number;
  rate: number;
  tax_percentage?: number;
  stock_on_hand?: number;
  last_modified_time: string;
}

export async function fetchInventoryItems(params: {
  integrationId: string;
  dataCenter: string;
  accountId: string;
  page?: number;
  modifiedAfter?: string;
}): Promise<{ items: ZohoInventoryItem[]; hasMore: boolean }> {
  const { integrationId, dataCenter, accountId, page = 1, modifiedAfter } = params;
  console.log({
    accountId,
    endpoint: "/inventory/v1/items",
  });
  const queryParams: Record<string, string | number> = {
    organization_id: accountId,
    page,
    per_page: 200,
  };

  if (modifiedAfter) queryParams.last_modified_time_start = modifiedAfter;

  const resp = await zohoFetch<unknown>({
    integrationId,
    dataCenter,
    path: "/inventory/v1/items",
    params: queryParams,
  });

  const rawData = resp as unknown as { items?: ZohoInventoryItem[]; page_context?: { has_more_page?: boolean } };
  return {
    items: rawData.items ?? [],
    hasMore: rawData.page_context?.has_more_page ?? false,
  };
}

// ---------------------------------------------------------------------------
// Test connection
// ---------------------------------------------------------------------------
export async function testZohoConnection(params: {
  integrationId: string;
  dataCenter: string;
}): Promise<{ success: boolean; latencyMs: number; details?: string; error?: string }> {
  const start = Date.now();
  try {
    const resp = await zohoFetch({
      integrationId: params.integrationId,
      dataCenter: params.dataCenter,
      path: "/crm/v7/org",
    });
    console.log("[ZOHO] contacts returned", resp.data?.length);
    console.log("[ZOHO] raw response", JSON.stringify(resp).slice(0, 1000));

    const latencyMs = Date.now() - start;
    const orgData = resp as unknown as { org?: Array<{ company_name?: string }> };
    return {
      success: true,
      latencyMs,
      details: `Connected to org: ${orgData.org?.[0]?.company_name ?? "Unknown"}`,
    };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
