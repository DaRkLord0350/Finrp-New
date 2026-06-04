// ============================================================
// GET /api/templates/guide?type=CUSTOMER|VENDOR|INVOICE|...
// Returns a styled HTML guide that users can print as PDF.
// ============================================================

import { auth } from "@clerk/nextjs/server";

// ---------------------------------------------------------------------------
// Guide definitions
// ---------------------------------------------------------------------------

interface GuideSection {
  title: string;
  items: string[];
}

interface GuideDefinition {
  entity: string;
  purpose: string;
  requiredColumns: Array<{ name: string; description: string }>;
  optionalColumns: Array<{ name: string; description: string }>;
  validationRules: string[];
  acceptedFormats: string[];
  sampleData: { headers: string[]; row: string[] };
  commonErrors: Array<{ error: string; solution: string }>;
  importProcess: string[];
}

const GUIDES: Record<string, GuideDefinition> = {
  CUSTOMER: {
    entity: "Customers",
    purpose: "Import customer profiles in bulk into FinRP. Supports businesses and individuals with contact info, GST/PAN details, and geographic information.",
    requiredColumns: [
      { name: "customer_name", description: "Full legal name of the customer or business" },
      { name: "email", description: "Primary contact email address (must be unique per org)" },
    ],
    optionalColumns: [
      { name: "customer_code", description: "Unique reference code (auto-generated if blank)" },
      { name: "phone", description: "Contact phone number (10 digits, Indian mobile)" },
      { name: "gst_number", description: "15-character GSTIN (e.g., 29ABCDE1234F1Z5)" },
      { name: "pan_number", description: "10-character PAN number (e.g., ABCDE1234F)" },
      { name: "address", description: "Street address" },
      { name: "city", description: "City name" },
      { name: "state", description: "State name" },
      { name: "country", description: "Country (default: India)" },
      { name: "pincode", description: "6-digit Indian PIN code" },
      { name: "industry", description: "Industry sector (e.g., Manufacturing, Technology)" },
      { name: "status", description: "Active or Inactive" },
    ],
    validationRules: [
      "Email must be a valid format (user@domain.com) and unique in your organization",
      "GSTIN must be exactly 15 characters: 2 digits + 10 alpha-numeric + 1 alpha + 1 alpha + 1 alpha-numeric (e.g., 29ABCDE1234F1Z5)",
      "PAN must be exactly 10 characters in format: 5 alpha + 4 digits + 1 alpha (e.g., ABCDE1234F)",
      "Phone must be 10 digits (Indian mobile) or 7-15 digits with country code",
      "Pincode must be exactly 6 digits",
    ],
    acceptedFormats: [
      "CSV (.csv) — UTF-8 encoded, comma-separated",
      "Excel (.xlsx) — First sheet is imported",
      "Excel (.xls) — Legacy format, first sheet is imported",
      "Maximum file size: 50 MB",
      "Maximum rows: 50,000 per import",
    ],
    sampleData: {
      headers: ["customer_code", "customer_name", "email", "phone", "gst_number", "city", "status"],
      row: ["CUS001", "ABC Industries", "contact@abc.com", "9876543210", "29ABCDE1234F1Z5", "Bangalore", "Active"],
    },
    commonErrors: [
      { error: "Duplicate email", solution: "Each customer must have a unique email. Remove duplicates from your file or enable 'Update Existing' to update existing records." },
      { error: "Invalid GSTIN checksum", solution: "Verify the GSTIN from GST Portal. Common issues: incorrect state code prefix, wrong check digit (last character)." },
      { error: "Phone number invalid", solution: "Remove spaces, hyphens, and country codes (+91). Enter 10-digit mobile number only." },
      { error: "Missing required field: customer_name", solution: "Every row must have a customer_name. Blank names will be rejected." },
    ],
    importProcess: [
      "Download the Customer CSV template from FinRP",
      "Open in Excel or Google Sheets",
      "Remove the 3 sample rows and add your customer data",
      "Save as CSV (UTF-8 encoded)",
      "Go to Integrations → CSV Import or Settings → Import Center",
      "Select 'Customers' as the import type",
      "Upload your CSV file",
      "Review the column mapping preview",
      "Click 'Start Import' — large files process in the background",
      "Download the error report if any rows failed",
    ],
  },

  VENDOR: {
    entity: "Vendors",
    purpose: "Import supplier and vendor profiles into FinRP. Used for purchase bills, expense tracking, and vendor management.",
    requiredColumns: [
      { name: "vendor_name", description: "Full legal name of the vendor or business" },
    ],
    optionalColumns: [
      { name: "vendor_code", description: "Unique vendor reference code" },
      { name: "email", description: "Vendor primary email address" },
      { name: "phone", description: "Vendor contact phone number" },
      { name: "gst_number", description: "Vendor's 15-character GSTIN" },
      { name: "pan_number", description: "Vendor's 10-character PAN" },
      { name: "address", description: "Registered address" },
      { name: "city", description: "City" },
      { name: "state", description: "State" },
      { name: "country", description: "Country (default: India)" },
      { name: "pincode", description: "6-digit PIN code" },
      { name: "status", description: "Active or Inactive" },
    ],
    validationRules: [
      "vendor_name is the only required field",
      "GSTIN and PAN are validated using the same rules as customers",
      "Duplicate detection: vendors with same GSTIN or email are flagged",
      "Phone must be valid Indian or international format",
    ],
    acceptedFormats: [
      "CSV (.csv) — UTF-8 encoded",
      "Excel (.xlsx, .xls)",
      "Max 50 MB, 50,000 rows per import",
    ],
    sampleData: {
      headers: ["vendor_code", "vendor_name", "email", "gst_number", "city", "status"],
      row: ["VEN001", "Rajesh Supplies", "raj@supplies.in", "29FGHI5678J1Z7", "Bangalore", "Active"],
    },
    commonErrors: [
      { error: "Duplicate GSTIN", solution: "Two vendors cannot share the same GSTIN. Check for data entry errors." },
      { error: "Invalid email format", solution: "Email must follow user@domain.com format." },
    ],
    importProcess: [
      "Download the Vendor CSV template",
      "Fill in vendor details (vendor_name is required, others are optional)",
      "Save as CSV",
      "Go to Integrations → CSV Import, select 'Vendors'",
      "Upload and import",
    ],
  },

  INVOICE: {
    entity: "Invoices",
    purpose: "Import historical or bulk sales invoices into FinRP. Customers referenced by customer_code must already exist.",
    requiredColumns: [
      { name: "invoice_number", description: "Unique invoice number (e.g., INV-2024-001)" },
      { name: "customer_code", description: "Customer code matching an existing customer in FinRP" },
      { name: "invoice_date", description: "Invoice date in DD/MM/YYYY or YYYY-MM-DD format" },
      { name: "total_amount", description: "Total invoice amount including taxes" },
    ],
    optionalColumns: [
      { name: "due_date", description: "Payment due date (defaults to invoice_date + 30 days)" },
      { name: "subtotal", description: "Amount before taxes" },
      { name: "tax_amount", description: "Total tax/GST amount" },
      { name: "status", description: "PAID, UNPAID, PARTIAL, OVERDUE, CANCELLED" },
    ],
    validationRules: [
      "invoice_number must be unique per organization",
      "invoice_date must not be more than 10 years in the past",
      "due_date must be on or after invoice_date",
      "total_amount must be a positive number",
      "customer_code must reference an existing customer",
      "Amounts must use decimal notation (e.g., 11800.00, not ₹11,800)",
    ],
    acceptedFormats: [
      "CSV or Excel, max 50 MB",
      "Amounts: decimal format without currency symbols",
      "Dates: DD/MM/YYYY or YYYY-MM-DD",
    ],
    sampleData: {
      headers: ["invoice_number", "customer_code", "invoice_date", "due_date", "total_amount", "status"],
      row: ["INV-2024-001", "CUS001", "01/04/2024", "01/05/2024", "11800.00", "PAID"],
    },
    commonErrors: [
      { error: "Customer not found", solution: "Import customers first, then import invoices. The customer_code must match exactly." },
      { error: "Duplicate invoice_number", solution: "Invoice numbers must be unique. Enable 'Update Existing' to overwrite." },
      { error: "Invalid date format", solution: "Use DD/MM/YYYY (e.g., 01/04/2024) or YYYY-MM-DD (e.g., 2024-04-01)." },
      { error: "due_date before invoice_date", solution: "The due date cannot be earlier than the invoice date." },
    ],
    importProcess: [
      "First ensure all referenced customers exist in FinRP",
      "Download Invoice CSV template",
      "Fill in invoice data",
      "Import via Integrations → CSV Import → Invoices",
    ],
  },

  PRODUCT: {
    entity: "Products",
    purpose: "Bulk import product catalog with pricing, GST rates, and initial stock levels.",
    requiredColumns: [
      { name: "product_name", description: "Product display name" },
    ],
    optionalColumns: [
      { name: "sku", description: "Stock Keeping Unit — unique product code" },
      { name: "category", description: "Product category (e.g., Electronics, Furniture)" },
      { name: "unit", description: "Unit of measure (PCS, KG, LITRE, REAM, etc.)" },
      { name: "price", description: "Selling price (decimal, e.g., 1200.00)" },
      { name: "gst_rate", description: "GST rate in % — must be 0, 5, 12, 18, or 28" },
      { name: "stock_quantity", description: "Opening stock quantity" },
      { name: "status", description: "Active or Inactive" },
    ],
    validationRules: [
      "product_name is required and must be unique per organization",
      "SKU must be unique if provided",
      "gst_rate must be one of: 0, 5, 12, 18, 28 (Indian GST slabs)",
      "price must be a positive decimal number",
      "stock_quantity must be a non-negative integer",
    ],
    acceptedFormats: [
      "CSV or Excel, max 50 MB",
      "GST rate: numeric only (e.g., 18, not 18%)",
      "Price: decimal without currency symbols",
    ],
    sampleData: {
      headers: ["sku", "product_name", "category", "price", "gst_rate", "stock_quantity"],
      row: ["SKU001", "Laptop Stand", "Electronics", "1200.00", "18", "50"],
    },
    commonErrors: [
      { error: "Invalid GST rate", solution: "GST rate must be exactly 0, 5, 12, 18, or 28. No other values accepted." },
      { error: "Duplicate SKU", solution: "Each product must have a unique SKU. Check for duplicates in your file." },
    ],
    importProcess: [
      "Download Product CSV template",
      "Fill in product details",
      "Import via Integrations → CSV Import → Products",
    ],
  },

  COMPLIANCE_CASE: {
    entity: "Compliance Cases",
    purpose: "Import compliance case records for bulk creation of filing deadlines, assigned CAs, and client compliance tracking.",
    requiredColumns: [
      { name: "client_name", description: "Name of the client (must match an existing customer)" },
      { name: "compliance_type", description: "Type of compliance (e.g., GST Monthly Return, Income Tax Return)" },
      { name: "due_date", description: "Filing deadline in DD/MM/YYYY format" },
    ],
    optionalColumns: [
      { name: "case_id", description: "Unique case reference ID" },
      { name: "assigned_ca", description: "Email of the CA assigned to this case" },
      { name: "status", description: "Pending, In Progress, Completed, Overdue" },
      { name: "priority", description: "High, Medium, Low" },
      { name: "remarks", description: "Internal notes or remarks" },
    ],
    validationRules: [
      "due_date must be a valid date and cannot be in the past by more than 1 year",
      "assigned_ca must be the email of an active CA in your organization",
      "compliance_type is a free-text field — use consistent naming for reporting",
      "priority must be High, Medium, or Low if provided",
    ],
    acceptedFormats: [
      "CSV or Excel, max 50 MB",
      "Dates: DD/MM/YYYY",
    ],
    sampleData: {
      headers: ["case_id", "client_name", "compliance_type", "due_date", "assigned_ca", "priority"],
      row: ["CASE-001", "ABC Industries", "GST Monthly Return", "20/04/2024", "rahul@ca.com", "High"],
    },
    commonErrors: [
      { error: "CA not found", solution: "The assigned_ca email must match an active CA user in your organization." },
      { error: "Invalid priority", solution: "Priority must be exactly 'High', 'Medium', or 'Low'." },
    ],
    importProcess: [
      "Ensure all CA users and clients are already in FinRP",
      "Download Compliance Cases template",
      "Import via Integrations → CSV Import → Compliance Cases",
    ],
  },

  CA_CLIENT: {
    entity: "CA Clients",
    purpose: "Import client profiles for CA firms with GSTIN, PAN, and CA assignment information.",
    requiredColumns: [
      { name: "client_name", description: "Full name of the client or business" },
      { name: "email", description: "Client email address (unique per org)" },
    ],
    optionalColumns: [
      { name: "client_code", description: "Unique client reference code" },
      { name: "gstin", description: "15-character GSTIN" },
      { name: "pan", description: "10-character PAN" },
      { name: "phone", description: "Contact phone number" },
      { name: "business_type", description: "Individual, Proprietorship, Partnership, LLP, Private Limited, Public Limited" },
      { name: "assigned_ca", description: "Email of the assigned CA" },
      { name: "status", description: "Active or Inactive" },
    ],
    validationRules: [
      "email must be unique per organization",
      "GSTIN validated for format and checksum",
      "PAN validated for format",
      "business_type must match one of the accepted values",
    ],
    acceptedFormats: [
      "CSV or Excel, max 50 MB",
    ],
    sampleData: {
      headers: ["client_code", "client_name", "gstin", "pan", "email", "assigned_ca"],
      row: ["CLI001", "Raj Enterprises", "29ABCDE1234F1Z5", "ABCDE1234F", "raj@ent.in", "ca@firm.com"],
    },
    commonErrors: [
      { error: "Duplicate email", solution: "Client emails must be unique. Merge duplicate client records before importing." },
      { error: "Invalid business_type", solution: "Use: Individual, Proprietorship, Partnership, LLP, Private Limited, or Public Limited." },
    ],
    importProcess: [
      "Download CA Client template",
      "Fill in client details",
      "Import via Integrations → CSV Import → CA Clients",
    ],
  },

  TREDS: {
    entity: "TReDS Transactions",
    purpose: "Import TReDS (Trade Receivables Discounting System) transactions for M1xchange and other TReDS platforms.",
    requiredColumns: [
      { name: "buyer_name", description: "Name of the invoice buyer (corporate)" },
      { name: "invoice_number", description: "Original invoice number being discounted" },
      { name: "invoice_amount", description: "Total invoice amount including GST" },
    ],
    optionalColumns: [
      { name: "transaction_id", description: "TReDS platform transaction ID" },
      { name: "seller_name", description: "MSME seller name" },
      { name: "discount_rate", description: "Annual discount rate in % (e.g., 8.50)" },
      { name: "financier", description: "Bank or NBFC providing finance" },
      { name: "status", description: "Awaiting Buyer Acceptance, Financed, Settled, Rejected" },
      { name: "transaction_date", description: "Date of TReDS transaction in DD/MM/YYYY" },
    ],
    validationRules: [
      "invoice_amount must be a positive decimal",
      "discount_rate must be between 1 and 36 (annual %)",
      "status must match one of the accepted values",
      "transaction_date must be a valid date",
    ],
    acceptedFormats: [
      "CSV or Excel, max 50 MB",
      "Amounts: decimal without currency symbols",
      "Rates: decimal percentage (e.g., 8.50, not 8.50%)",
    ],
    sampleData: {
      headers: ["transaction_id", "buyer_name", "invoice_number", "invoice_amount", "discount_rate", "financier", "status"],
      row: ["TRD-001", "ABC Industries", "INV-001", "118000.00", "8.50", "HDFC Bank", "Financed"],
    },
    commonErrors: [
      { error: "Invalid discount_rate", solution: "Rate must be a number between 1 and 36. Do not include % symbol." },
      { error: "Invalid status", solution: "Accepted values: Awaiting Buyer Acceptance, Financed, Settled, Rejected." },
    ],
    importProcess: [
      "Export TReDS data from M1xchange or your TReDS platform",
      "Map columns using the template",
      "Import via Integrations → CSV Import → TReDS Transactions",
    ],
  },

  CA_USER: {
    entity: "CA Users (Staff)",
    purpose: "Onboard CA staff members into your FinRP organization. Invitation emails are sent automatically.",
    requiredColumns: [
      { name: "name", description: "Full name of the CA staff member" },
      { name: "email", description: "Work email address — used for login" },
    ],
    optionalColumns: [
      { name: "phone", description: "Mobile phone number" },
      { name: "designation", description: "Job title (e.g., Senior CA, Manager CA)" },
      { name: "icai_number", description: "ICAI membership number" },
      { name: "specialization", description: "Areas of expertise (semicolon-separated)" },
      { name: "firm_registration_number", description: "Firm's ICAI registration number" },
    ],
    validationRules: [
      "email is required and must be unique across the platform",
      "Invitation emails are sent to all imported CA users",
      "icai_number should be unique if provided",
    ],
    acceptedFormats: [
      "CSV or Excel, max 50 MB",
      "Maximum 500 CA users per import",
    ],
    sampleData: {
      headers: ["name", "email", "designation", "icai_number"],
      row: ["Rahul Sharma", "rahul@firm.com", "Senior CA", "ICAI123456"],
    },
    commonErrors: [
      { error: "Email already exists", solution: "This email is already registered in FinRP. CA user accounts are unique globally." },
      { error: "Invitation failed", solution: "Check spam filters. Resend invitations from Users & Roles settings." },
    ],
    importProcess: [
      "Download CA User template",
      "Fill in CA staff details",
      "Import — invitations are sent automatically",
    ],
  },
};

// ---------------------------------------------------------------------------
// HTML guide builder
// ---------------------------------------------------------------------------

function buildHtmlGuide(type: string, guide: GuideDefinition): string {
  const requiredCols = guide.requiredColumns.map((c) =>
    `<tr><td class="col-name">${c.name}</td><td class="req-badge">Required</td><td>${c.description}</td></tr>`
  ).join("");

  const optionalCols = guide.optionalColumns.map((c) =>
    `<tr><td class="col-name">${c.name}</td><td class="opt-badge">Optional</td><td>${c.description}</td></tr>`
  ).join("");

  const validationRules = guide.validationRules.map((r) => `<li>${r}</li>`).join("");

  const formats = guide.acceptedFormats.map((f) => `<li>${f}</li>`).join("");

  const sampleHeaders = guide.sampleData.headers.map((h) => `<th>${h}</th>`).join("");
  const sampleRow = guide.sampleData.row.map((v) => `<td>${v}</td>`).join("");

  const errors = guide.commonErrors.map((e) =>
    `<div class="error-card">
      <div class="error-title">⚠ ${e.error}</div>
      <div class="error-solution">✓ ${e.solution}</div>
    </div>`
  ).join("");

  const steps = guide.importProcess.map((s, i) => `<div class="step"><span class="step-num">${i + 1}</span>${s}</div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FinRP Import Guide — ${guide.entity}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 32px; max-width: 900px; margin: 0 auto; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
  .logo { width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #06b6d4); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 18px; flex-shrink: 0; }
  .header-text h1 { font-size: 22px; font-weight: 800; color: #0f172a; }
  .header-text p { color: #64748b; margin-top: 3px; font-size: 13px; }
  .print-btn { margin-left: auto; padding: 8px 16px; background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .section h2::before { content: ''; width: 4px; height: 16px; background: linear-gradient(135deg, #3b82f6, #06b6d4); border-radius: 2px; }
  .purpose-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 14px 16px; color: #0369a1; font-size: 13px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #f8fafc; border: 1px solid #e2e8f0; padding: 9px 12px; text-align: left; font-weight: 600; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  td { border: 1px solid #e2e8f0; padding: 8px 12px; vertical-align: top; }
  .col-name { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; color: #1e40af; background: #eff6ff; font-weight: 600; }
  .req-badge { background: #fef2f2; color: #dc2626; font-size: 10px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
  .opt-badge { background: #f0fdf4; color: #16a34a; font-size: 10px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
  ul, ol { padding-left: 18px; }
  li { margin-bottom: 5px; line-height: 1.6; color: #374151; }
  .formats-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
  .sample-table th { background: #1e293b; color: #e2e8f0; border-color: #334155; }
  .sample-table td { background: #f8fafc; font-family: monospace; font-size: 11px; }
  .error-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
  .error-title { color: #92400e; font-weight: 600; margin-bottom: 5px; font-size: 12px; }
  .error-solution { color: #065f46; font-size: 12px; }
  .step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
  .step-num { width: 24px; height: 24px; background: linear-gradient(135deg, #3b82f6, #06b6d4); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
  .step { align-items: center; }
  .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px; }
  @media print {
    .print-btn { display: none; }
    body { padding: 16px; }
    @page { margin: 1.5cm; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="logo">F</div>
  <div class="header-text">
    <h1>FinRP Import Guide — ${guide.entity}</h1>
    <p>Template type: ${type} · Generated by FinRP Import Center</p>
  </div>
  <button class="print-btn" onclick="window.print()">⬇ Save as PDF</button>
</div>

<div class="section">
  <h2>1. Purpose</h2>
  <div class="purpose-box">${guide.purpose}</div>
</div>

<div class="section">
  <h2>2. Required Columns</h2>
  <table>
    <thead><tr><th>Column Name</th><th>Type</th><th>Description</th></tr></thead>
    <tbody>${requiredCols}</tbody>
  </table>
</div>

<div class="section">
  <h2>3. Optional Columns</h2>
  <table>
    <thead><tr><th>Column Name</th><th>Type</th><th>Description</th></tr></thead>
    <tbody>${optionalCols}</tbody>
  </table>
</div>

<div class="section">
  <h2>4. Validation Rules</h2>
  <ul>${validationRules}</ul>
</div>

<div class="section">
  <h2>5. Accepted Formats</h2>
  <div class="formats-box"><ul>${formats}</ul></div>
</div>

<div class="section">
  <h2>6. Sample Data</h2>
  <table class="sample-table">
    <thead><tr>${sampleHeaders}</tr></thead>
    <tbody><tr>${sampleRow}</tr></tbody>
  </table>
</div>

<div class="section">
  <h2>7. Common Errors &amp; Solutions</h2>
  ${errors}
</div>

<div class="section">
  <h2>8. Import Process</h2>
  <div style="display:flex;flex-direction:column;gap:6px">${steps}</div>
</div>

<div class="footer">
  <p>FinRP Import Center · This guide was auto-generated. For support, contact your FinRP administrator.</p>
</div>

<script>
  // Auto-focus for keyboard users
  document.querySelector('.print-btn')?.focus();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") ?? "CUSTOMER").toUpperCase();

  const guide = GUIDES[type];
  if (!guide) {
    return new Response(
      `Invalid guide type. Valid values: ${Object.keys(GUIDES).join(", ")}`,
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }

  const html = buildHtmlGuide(type, guide);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
