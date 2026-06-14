import { FolderLock, ScanText, Share2, HardDrive } from "lucide-react";
import { ModuleLanding, Kpi } from "@/components/ca-hub/ui";

export default function DocumentVault() {
  return (
    <ModuleLanding
      slug="documents"
      kpis={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="Documents" value="12,480" icon={FolderLock} accent="#14b8a6" sub="across all clients" />
          <Kpi label="OCR Indexed" value="96%" icon={ScanText} accent="#10b981" sub="full-text searchable" />
          <Kpi label="Active Share Links" value={84} icon={Share2} accent="#6366f1" sub="expiring + audited" />
          <Kpi label="Storage Used" value="42 GB" icon={HardDrive} accent="#f59e0b" />
        </div>
      }
    />
  );
}
