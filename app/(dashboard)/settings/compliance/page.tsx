import { redirect } from "next/navigation";
import { getTenantId } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";
import ComplianceDocsClient from "./ComplianceDocsClient";

const DOCUMENT_TYPES = [
  { key: "PAN", label: "PAN Card" },
  { key: "GST_CERTIFICATE", label: "GST Certificate" },
  { key: "INCORPORATION", label: "Incorporation Certificate" },
  { key: "BANK_STATEMENT", label: "Bank Statement" },
  { key: "MSME", label: "MSME Certificate" },
  { key: "TAN", label: "TAN Certificate" },
  { key: "ADDRESS_PROOF", label: "Address Proof" },
  { key: "FINANCIAL_STATEMENTS", label: "Financial Statements" },
];

export default async function ComplianceDocumentsPage() {
  const organizationId = await getTenantId();
  if (!organizationId) redirect("/sign-in");

  const uploaded = await prisma.organizationDocument.findMany({
    where: { organizationId },
    orderBy: { uploadedAt: "desc" },
  });

  const documents = DOCUMENT_TYPES.map((type) => {
    const doc = uploaded.find((d) => d.documentType === type.key);
    return {
      documentType: type.key,
      displayName: type.label,
      required: true,
      document: doc
        ? {
            ...doc,
            uploadedAt: doc.uploadedAt.toISOString(),
            expiryDate: doc.expiryDate?.toISOString() ?? null,
            notes: null,
          }
        : null,
    };
  });

  return <ComplianceDocsClient initialDocuments={documents} />;
}
