export type WizardStep = "choose" | "template" | "upload" | "preview" | "importing" | "results";

export interface EntityType {
  id: string;
  label: string;
  apiEntity: string;
  description: string;
  icon: React.FC<{ size?: number; color?: string }>;
  color: string;
  gradient: string;
  fields: string[];
  templateType: string;
}

export interface UploadResult {
  importJobId: string;
  detectedColumns: string[];
  needsMapping: boolean;
}

export interface PreviewRow {
  [key: string]: string;
}

export interface ImportResultSummary {
  totalRows: number;
  successRows: number;
  failedRows: number;
  duplicateRows: number;
}
