export interface Customer {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
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
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
}

export interface InvoiceSuccess {
  invoiceId: string;
  invoiceNumber: string;
  pdfUrl?: string;
}
