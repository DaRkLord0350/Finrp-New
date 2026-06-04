import {
  Users, Building2, FileText, Package,
  Layers, Scale, UserCheck, BarChart3,
} from "lucide-react";
import type { EntityType } from "./types";

export const ENTITY_TYPES: EntityType[] = [
  {
    id: "customers", label: "Customers", apiEntity: "CUSTOMERS",
    description: "Import customer profiles with GSTIN, PAN, contact details, and business info",
    icon: Users, color: "#3b82f6",
    gradient: "linear-gradient(135deg, #60a5fa, #3b82f6)",
    fields: ["customer_code", "name", "email", "phone", "gst_number", "pan_number", "city"],
    templateType: "CUSTOMER",
  },
  {
    id: "vendors", label: "Vendors", apiEntity: "VENDORS",
    description: "Bulk import suppliers and vendors with GST and bank details",
    icon: Building2, color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #a78bfa, #8b5cf6)",
    fields: ["vendor_code", "vendor_name", "email", "phone", "gst_number", "status"],
    templateType: "VENDOR",
  },
  {
    id: "invoices", label: "Invoices", apiEntity: "INVOICES",
    description: "Import sales invoices with customer mapping, tax details, and due dates",
    icon: FileText, color: "#06b6d4",
    gradient: "linear-gradient(135deg, #22d3ee, #06b6d4)",
    fields: ["invoice_number", "customer_code", "invoice_date", "total_amount", "status"],
    templateType: "INVOICE",
  },
  {
    id: "bills", label: "Bills", apiEntity: "VENDORS",
    description: "Import purchase bills with vendor mapping and payment tracking",
    icon: FileText, color: "#f59e0b",
    gradient: "linear-gradient(135deg, #fbbf24, #f59e0b)",
    fields: ["bill_number", "vendor_code", "bill_date", "total_amount", "status"],
    templateType: "BILL",
  },
  {
    id: "products", label: "Products", apiEntity: "PRODUCTS",
    description: "Bulk add products with SKU, pricing, GST rates, and stock levels",
    icon: Package, color: "#10b981",
    gradient: "linear-gradient(135deg, #34d399, #10b981)",
    fields: ["sku", "product_name", "category", "price", "gst_rate", "stock_quantity"],
    templateType: "PRODUCT",
  },
  {
    id: "inventory", label: "Inventory", apiEntity: "PRODUCTS",
    description: "Update stock levels, warehouse allocations, and reorder points",
    icon: Layers, color: "#ec4899",
    gradient: "linear-gradient(135deg, #f472b6, #ec4899)",
    fields: ["sku", "warehouse", "current_stock", "minimum_stock", "reorder_level"],
    templateType: "INVENTORY",
  },
  {
    id: "compliance", label: "Compliance Cases", apiEntity: "CUSTOMERS",
    description: "Import compliance filings with deadlines, assigned CA, and priorities",
    icon: Scale, color: "#e05a00",
    gradient: "linear-gradient(135deg, #fb923c, #e05a00)",
    fields: ["case_id", "client_name", "compliance_type", "due_date", "assigned_ca"],
    templateType: "COMPLIANCE_CASE",
  },
  {
    id: "ca-clients", label: "CA Clients", apiEntity: "CUSTOMERS",
    description: "Import CA client profiles with GSTIN, PAN, and assigned CA details",
    icon: UserCheck, color: "#0f9d58",
    gradient: "linear-gradient(135deg, #34d399, #0f9d58)",
    fields: ["client_code", "client_name", "gstin", "pan", "assigned_ca"],
    templateType: "CA_CLIENT",
  },
  {
    id: "treds", label: "TReDS Transactions", apiEntity: "CUSTOMERS",
    description: "Import TReDS trade receivable transactions and financing details",
    icon: BarChart3, color: "#6c4dd6",
    gradient: "linear-gradient(135deg, #8b6cf7, #6c4dd6)",
    fields: ["transaction_id", "buyer_name", "invoice_amount", "discount_rate", "financier"],
    templateType: "TREDS",
  },
];

export const STEP_CONFIG = [
  { id: "choose", label: "Choose Type" },
  { id: "template", label: "Download" },
  { id: "upload", label: "Upload" },
  { id: "preview", label: "Preview" },
  { id: "importing", label: "Import" },
  { id: "results", label: "Complete" },
] as const;
