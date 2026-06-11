import { ClipboardCheck, Hammer, BadgeCheck, FileSignature } from "lucide-react";
import { ModuleLanding, Kpi } from "@/components/ca-hub/ui";
import { practiceKpis } from "@/lib/ca-hub/demo-data";

export default function AuditWorkspace() {
  return (
    <ModuleLanding
      slug="audit"
      kpis={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="Active Engagements" value={31} icon={ClipboardCheck} accent="#ec4899" sub={`${practiceKpis.auditPending} pending sign-off`} />
          <Kpi label="In Fieldwork" value={14} icon={Hammer} accent="#f59e0b" />
          <Kpi label="UDINs Generated" value={206} icon={BadgeCheck} accent="#10b981" sub="this FY" />
          <Kpi label="3CA/3CB/3CD" value={22} icon={FileSignature} accent="#6366f1" sub="tax audits" />
        </div>
      }
    />
  );
}
