// ============================================================
// GET /api/templates?type=CUSTOMER|VENDOR|INVOICE|BILL|PRODUCT|INVENTORY|COMPLIANCE_CASE|CA_CLIENT|TREDS|CA_USER|FIRM|ASSIGNMENT|MASTER
// Returns a downloadable CSV template for the requested entity.
// ============================================================

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

interface TemplateDefinition {
  filename: string;
  headers: string[];
  rows: string[][];
}

const TEMPLATES: Record<string, TemplateDefinition> = {
  // ── Customers ──────────────────────────────────────────────────────────────
  CUSTOMER: {
    filename: "finrp_customer_template.csv",
    headers: [
      "customer_code", "customer_name", "email", "phone", "gst_number",
      "pan_number", "address", "city", "state", "country", "pincode",
      "industry", "status",
    ],
    rows: [
      [
        "CUS001", "ABC Industries", "contact@abc.com", "9876543210",
        "29ABCDE1234F1Z5", "ABCDE1234F",
        "MG Road", "Bangalore", "Karnataka", "India", "560001",
        "Manufacturing", "Active",
      ],
      [
        "CUS002", "Amit Kumar", "amit.kumar@gmail.com", "9822222222",
        "", "",
        "HSR Layout", "Bangalore", "Karnataka", "India", "560102",
        "Individual", "Active",
      ],
      [
        "CUS003", "TechStart Pvt Ltd", "hello@techstart.in", "9833333333",
        "27ABCDE5678G1Z3", "ABCDE5678G",
        "Bandra Kurla Complex", "Mumbai", "Maharashtra", "India", "400051",
        "Technology", "Active",
      ],
    ],
  },

  // ── Vendors ────────────────────────────────────────────────────────────────
  VENDOR: {
    filename: "finrp_vendor_template.csv",
    headers: [
      "vendor_code", "vendor_name", "email", "phone", "gst_number",
      "pan_number", "address", "city", "state", "country", "pincode", "status",
    ],
    rows: [
      [
        "VEN001", "Rajesh Supplies", "raj@supplies.in", "9844444444",
        "29FGHI5678J1Z7", "FGHI5678J",
        "Whitefield", "Bangalore", "Karnataka", "India", "560066",
        "Active",
      ],
      [
        "VEN002", "Global Traders", "info@globaltraders.in", "9855555555",
        "27JKLM9012K2Z8", "JKLM9012K",
        "Andheri East", "Mumbai", "Maharashtra", "India", "400069",
        "Active",
      ],
      [
        "VEN003", "Prime Components", "prime@components.com", "9866666666",
        "06NOPQ3456L3Z9", "NOPQ3456L",
        "Sector 18", "Noida", "Uttar Pradesh", "India", "201301",
        "Active",
      ],
    ],
  },

  // ── Invoices ───────────────────────────────────────────────────────────────
  INVOICE: {
    filename: "finrp_invoice_template.csv",
    headers: [
      "invoice_number", "customer_code", "invoice_date", "due_date",
      "subtotal", "tax_amount", "total_amount", "status",
    ],
    rows: [
      ["INV-2024-001", "CUS001", "01/04/2024", "01/05/2024", "10000.00", "1800.00", "11800.00", "PAID"],
      ["INV-2024-002", "CUS002", "15/04/2024", "15/05/2024", "25000.00", "4500.00", "29500.00", "UNPAID"],
      ["INV-2024-003", "CUS003", "30/04/2024", "30/05/2024", "50000.00", "9000.00", "59000.00", "PARTIAL"],
    ],
  },

  // ── Bills ──────────────────────────────────────────────────────────────────
  BILL: {
    filename: "finrp_bill_template.csv",
    headers: [
      "bill_number", "vendor_code", "bill_date", "due_date",
      "subtotal", "tax_amount", "total_amount", "status",
    ],
    rows: [
      ["BILL-2024-001", "VEN001", "01/04/2024", "01/05/2024", "8000.00", "1440.00", "9440.00", "PAID"],
      ["BILL-2024-002", "VEN002", "15/04/2024", "15/05/2024", "15000.00", "2700.00", "17700.00", "UNPAID"],
      ["BILL-2024-003", "VEN003", "30/04/2024", "30/05/2024", "30000.00", "5400.00", "35400.00", "PARTIAL"],
    ],
  },

  // ── Products ───────────────────────────────────────────────────────────────
  PRODUCT: {
    filename: "finrp_product_template.csv",
    headers: [
      "sku", "product_name", "category", "unit", "price",
      "gst_rate", "stock_quantity", "status",
    ],
    rows: [
      ["SKU001", "Laptop Stand", "Electronics", "PCS", "1200.00", "18", "50", "Active"],
      ["SKU002", "A4 Paper Ream", "Stationery", "REAM", "250.00", "5", "200", "Active"],
      ["SKU003", "Office Chair", "Furniture", "PCS", "8500.00", "18", "25", "Active"],
    ],
  },

  // ── Inventory ──────────────────────────────────────────────────────────────
  INVENTORY: {
    filename: "finrp_inventory_template.csv",
    headers: [
      "sku", "warehouse", "opening_stock", "current_stock",
      "minimum_stock", "reorder_level",
    ],
    rows: [
      ["SKU001", "Warehouse-BLR", "100", "50", "10", "20"],
      ["SKU002", "Warehouse-MUM", "500", "200", "50", "100"],
      ["SKU003", "Warehouse-DEL", "75", "25", "5", "15"],
    ],
  },

  // ── Compliance Cases ───────────────────────────────────────────────────────
  COMPLIANCE_CASE: {
    filename: "finrp_compliance_cases_template.csv",
    headers: [
      "case_id", "client_name", "compliance_type", "due_date",
      "assigned_ca", "status", "priority", "remarks",
    ],
    rows: [
      [
        "CASE-2024-001", "ABC Industries", "GST Monthly Return",
        "20/04/2024", "rahul@abcca.com", "Pending", "High",
        "GSTR-3B for March 2024",
      ],
      [
        "CASE-2024-002", "Amit Kumar", "Income Tax Return",
        "31/07/2024", "priya@abcca.com", "In Progress", "Medium",
        "ITR-1 for FY 2023-24",
      ],
      [
        "CASE-2024-003", "TechStart Pvt Ltd", "Annual Audit",
        "30/09/2024", "kiran@abcca.com", "Not Started", "High",
        "Statutory audit for FY 2023-24",
      ],
    ],
  },

  // ── CA Clients ─────────────────────────────────────────────────────────────
  CA_CLIENT: {
    filename: "finrp_ca_clients_template.csv",
    headers: [
      "client_code", "client_name", "gstin", "pan",
      "email", "phone", "business_type", "assigned_ca", "status",
    ],
    rows: [
      [
        "CLI001", "Raj Enterprises", "29ABCDE1234F1Z5", "ABCDE1234F",
        "raj@enterprises.in", "9877777777",
        "Private Limited", "rahul@abcca.com", "Active",
      ],
      [
        "CLI002", "Priya Sharma", "", "PQRST5678U",
        "priya.sharma@gmail.com", "9888888888",
        "Individual", "priya@abcca.com", "Active",
      ],
      [
        "CLI003", "Future Tech LLP", "27UVWXY9012V2Z3", "UVWXY9012V",
        "info@futuretech.in", "9899999999",
        "LLP", "kiran@abcca.com", "Active",
      ],
    ],
  },

  // ── TReDS Transactions ─────────────────────────────────────────────────────
  TREDS: {
    filename: "finrp_treds_transactions_template.csv",
    headers: [
      "transaction_id", "buyer_name", "seller_name", "invoice_number",
      "invoice_amount", "discount_rate", "financier", "status", "transaction_date",
    ],
    rows: [
      [
        "TRD-2024-001", "ABC Industries", "Rajesh Supplies", "INV-2024-001",
        "118000.00", "8.50", "HDFC Bank", "Financed", "05/04/2024",
      ],
      [
        "TRD-2024-002", "TechStart Pvt Ltd", "Global Traders", "INV-2024-002",
        "295000.00", "9.00", "ICICI Bank", "Awaiting Buyer Acceptance", "10/04/2024",
      ],
      [
        "TRD-2024-003", "ABC Industries", "Prime Components", "INV-2024-003",
        "59000.00", "7.75", "Axis Bank", "Settled", "15/04/2024",
      ],
    ],
  },

  // ── CA Users ───────────────────────────────────────────────────────────────
  CA_USER: {
    filename: "finrp_ca_user_template.csv",
    headers: [
      "name", "email", "phone", "designation", "icai_number",
      "specialization", "firm_registration_number",
    ],
    rows: [
      [
        "Rahul Sharma", "rahul@abcassociates.com", "+919833333333",
        "Senior CA", "ICAI123456", "GST & Income Tax", "ICAI123456",
      ],
      [
        "Priya Singh", "priya@abcassociates.com", "+919844444444",
        "CA", "ICAI789012", "Audit & Assurance", "ICAI123456",
      ],
      [
        "Kiran Mehta", "kiran@abcassociates.com", "+919855555555",
        "Manager CA", "ICAI345678", "Corporate Tax & Compliance", "ICAI123456",
      ],
    ],
  },

  // ── Firms ──────────────────────────────────────────────────────────────────
  FIRM: {
    filename: "finrp_firm_template.csv",
    headers: [
      "firm_name", "registration_number", "email", "phone",
      "address", "city", "state", "country", "specialization", "website",
    ],
    rows: [
      [
        "ABC & Associates", "ICAI123456", "contact@abcassociates.com",
        "+919811111111", "12 MG Road", "Bangalore", "Karnataka", "India",
        "GST;ITR;Audit", "www.abcassociates.com",
      ],
      [
        "XYZ Chartered Accountants", "ICAI789012", "info@xyzca.com",
        "+919822222222", "42 Connaught Place", "Delhi", "Delhi", "India",
        "Corporate Tax;Transfer Pricing", "",
      ],
    ],
  },

  // ── Assignments ────────────────────────────────────────────────────────────
  ASSIGNMENT: {
    filename: "finrp_assignment_template.csv",
    headers: [
      "customer_email", "customer_code", "ca_email",
      "service_type", "start_date", "end_date", "notes", "priority",
    ],
    rows: [
      [
        "accounts@rajent.com", "CUS001", "rahul@abcassociates.com",
        "GST Filing", "2024-04-01", "2025-03-31", "Quarterly GST Returns", "HIGH",
      ],
      [
        "amit@gmail.com", "CUS002", "priya@abcassociates.com",
        "ITR Filing", "2024-04-01", "2025-03-31", "Annual Income Tax Return", "MEDIUM",
      ],
      [
        "hello@techstart.in", "CUS003", "kiran@abcassociates.com",
        "Audit", "2024-04-01", "2025-03-31", "Statutory Audit", "HIGH",
      ],
    ],
  },

  // ── Master Import ──────────────────────────────────────────────────────────
  MASTER: {
    filename: "finrp_master_import_template.csv",
    headers: [
      "customer_code", "name", "email", "phone", "company", "gstin", "pan",
      "address", "city", "state", "country", "customer_type",
      "assigned_ca_email", "firm_registration_number", "tags", "notes",
    ],
    rows: [
      [
        "CUS001", "Raj Enterprises", "accounts@rajent.com", "+919811111111",
        "Raj Enterprises Pvt Ltd", "29ABCDE1234F1Z5", "ABCDE1234F",
        "Electronic City", "Bangalore", "Karnataka", "India", "BUSINESS",
        "rahul@abcassociates.com", "ICAI123456", "GST;TDS", "Annual Filing",
      ],
      [
        "CUS002", "Amit Kumar", "amit@gmail.com", "+919822222222",
        "", "", "",
        "HSR Layout", "Bangalore", "Karnataka", "India", "INDIVIDUAL",
        "priya@abcassociates.com", "ICAI123456", "ITR", "Income Tax Return",
      ],
      [
        "CUS003", "TechStart Pvt Ltd", "hello@techstart.in", "+919833333333",
        "TechStart Private Limited", "27ABCDE5678G1Z3", "ABCDE5678G",
        "Bandra Kurla Complex", "Mumbai", "Maharashtra", "India", "BUSINESS",
        "kiran@abcassociates.com", "ICAI123456", "Audit;GST", "Statutory Audit",
      ],
    ],
  },
};

// ---------------------------------------------------------------------------
// CSV builder with proper RFC 4180 quoting
// ---------------------------------------------------------------------------

function buildCsv(headers: string[], rows: string[][]): string {
  const quote = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("\r")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const lines = [
    headers.map(quote).join(","),
    ...rows.map((row) => row.map(quote).join(",")),
  ];

  return lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "CUSTOMER").toUpperCase();

  const template = TEMPLATES[type];
  if (!template) {
    return NextResponse.json(
      { error: `Invalid template type. Valid values: ${Object.keys(TEMPLATES).join(", ")}` },
      { status: 400 }
    );
  }

  const csvContent = buildCsv(template.headers, template.rows);

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${template.filename}"`,
      "Cache-Control": "no-cache, no-store",
    },
  });
}
