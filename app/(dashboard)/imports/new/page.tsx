// ============================================================
// /imports/new — Import Wizard page
// ============================================================

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ImportWizard } from "@/components/imports/ImportWizard";

export const metadata = {
  title: "New Import — FinRP",
};

export default async function NewImportPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground mt-1">
          Upload a CSV or Excel file to import customers, invoices, or products.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
