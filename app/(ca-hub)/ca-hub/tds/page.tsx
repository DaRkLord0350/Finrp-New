import { Landmark, CheckCircle2, FileText, GitCompareArrows } from "lucide-react";
import { ModuleLanding, Kpi } from "@/components/ca-hub/ui";
import { practiceKpis } from "@/lib/ca-hub/demo-data";

export default function TdsCenter() {
  return (
    <ModuleLanding
      slug="tds"
      kpis={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="Returns Due" value={practiceKpis.tdsDue} icon={Landmark} accent="#06b6d4" sub="Q1 FY26-27" />
          <Kpi label="Returns Filed" value={198} icon={CheckCircle2} accent="#10b981" />
          <Kpi label="Form 16 / 16A" value={412} icon={FileText} accent="#8b5cf6" sub="generated" />
          <Kpi label="Challan Matched" value="94%" icon={GitCompareArrows} accent="#22c55e" sub="OLTAS recon" />
        </div>
      }
    />
  );
}
