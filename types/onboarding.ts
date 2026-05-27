// ============================================================
// FinRP — Onboarding Types
// ============================================================

export type OnboardingModule =
  | "CRM"
  | "INVENTORY"
  | "ACCOUNTING"
  | "HR"
  | "BILLING"
  | "ANALYTICS";

export type InviteRole = "ADMIN" | "MANAGER" | "ACCOUNTANT" | "STAFF" | "VIEWER";

export type DataImportOption = "CSV" | "ZOHO" | "TALLY" | "DEMO" | "EMPTY";

export type ThemePreference = "dark" | "light" | "system";

export type DashboardLayout = "default" | "compact" | "detailed";

export interface OnboardingInvite {
  email: string;
  role: InviteRole;
}

export interface OnboardingState {
  // Step 2: Organization Details
  orgName: string;
  businessType: string;
  gstNumber: string;
  currency: string;
  timezone: string;
  logoUrl: string;
  address: string;
  // Step 3: Modules
  enabledModules: OnboardingModule[];
  // Step 4: Invites
  invites: OnboardingInvite[];
  // Step 5: Data Import
  importOption: DataImportOption | null;
  // Step 7: Preferences
  theme: ThemePreference;
  emailNotifications: boolean;
  smsNotifications: boolean;
  dashboardLayout: DashboardLayout;
}

export interface OnboardingStepDef {
  id: number;
  title: string;
  subtitle: string;
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  { id: 1, title: "Welcome", subtitle: "Getting started" },
  { id: 2, title: "Organization", subtitle: "Company details" },
  { id: 3, title: "Modules", subtitle: "Feature selection" },
  { id: 4, title: "Team", subtitle: "Invite members" },
  { id: 5, title: "Data Import", subtitle: "Import your data" },
  { id: 6, title: "Demo Data", subtitle: "Sample data" },
  { id: 7, title: "Preferences", subtitle: "Customize" },
  { id: 8, title: "Complete", subtitle: "All done!" },
];

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  orgName: "",
  businessType: "",
  gstNumber: "",
  currency: "INR",
  timezone: "Asia/Kolkata",
  logoUrl: "",
  address: "",
  enabledModules: ["CRM", "BILLING", "ACCOUNTING"],
  invites: [],
  importOption: null,
  theme: "dark",
  emailNotifications: true,
  smsNotifications: false,
  dashboardLayout: "default",
};

export interface OnboardingActionResult {
  success: boolean;
  error?: string;
}

export interface DemoSeedResult {
  success: boolean;
  seeded: {
    customers: number;
    items: number;
    invoices: number;
    expenses: number;
    employees: number;
  };
  error?: string;
}
