import { Building2, CheckCircle2, IdCard, Briefcase } from "lucide-react";
import { ModuleLanding, Kpi } from "@/components/ca-hub/ui";
import { practiceKpis } from "@/lib/ca-hub/demo-data";

export default function RocCenter() {
  return (
    <ModuleLanding
      slug="roc"
      kpis={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="Forms Due" value={practiceKpis.rocDue} icon={Building2} accent="#f43f5e" sub="AOC-4 / MGT-7" />
          <Kpi label="Filed (FY)" value={64} icon={CheckCircle2} accent="#10b981" />
          <Kpi label="DIR-3 KYC" value={38} icon={IdCard} accent="#06b6d4" sub="directors" />
          <Kpi label="Companies / LLPs" value={47} icon={Briefcase} accent="#6366f1" />
        </div>
      }
    />
  );
}
