export interface Customer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address?: string | null;
  gstin?: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  sellingPrice: string;
  taxRate: string;
  stock: number;
  isActive: boolean;
}

export interface LineItem {
  id: string;
  itemId?: string;
  sku?: string;
  hsnSac?: string;
  unit?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // per-line flat discount amount
  taxPercent: number;
}

export interface TdsTcsSection {
  id: string;
  type: "TDS" | "TCS";
  code: string;
  name: string;
  rate: string | number;
  isActive: boolean;
}

export interface RecurringConfig {
  enabled: boolean;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM";
  customIntervalDays: number;
  startDate: string;
  endDate: string;
}

export interface StagedAttachment {
  id: string; // local-only id
  file: File;
  previewUrl?: string; // object URL for image previews
}

export interface CustomField {
  label: string;
  value: string;
}

export interface InvoiceSuccess {
  invoiceId: string;
  invoiceNumber: string;
  pdfUrl?: string;
}
