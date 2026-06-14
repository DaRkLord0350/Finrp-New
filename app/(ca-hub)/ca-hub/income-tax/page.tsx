import { FileSpreadsheet, CheckCircle2, Download, Wallet } from "lucide-react";
import { ModuleLanding, Kpi } from "@/components/ca-hub/ui";
import { practiceKpis, formatINR } from "@/lib/ca-hub/demo-data";

export default function IncomeTaxCenter() {
  return (
    <ModuleLanding
      slug="income-tax"
      kpis={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="ITR Due" value={practiceKpis.itrDue} icon={FileSpreadsheet} accent="#8b5cf6" sub="AY 2026-27" />
          <Kpi label="Returns Filed" value={88} icon={CheckCircle2} accent="#10b981" sub="this season" />
          <Kpi label="AIS / TIS Imported" value={52} icon={Download} accent="#06b6d4" sub="auto-reconciled" />
          <Kpi label="Refunds Tracked" value={formatINR(4820000)} icon={Wallet} accent="#f59e0b" />
        </div>
      }
    />
  );
}
