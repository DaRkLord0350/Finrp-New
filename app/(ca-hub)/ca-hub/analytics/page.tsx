import { TrendingUp, Gauge, HeartPulse, Percent } from "lucide-react";
import { ModuleLanding, Kpi } from "@/components/ca-hub/ui";
import { practiceKpis, formatINR } from "@/lib/ca-hub/demo-data";

export default function PracticeAnalytics() {
  return (
    <ModuleLanding
      slug="analytics"
      kpis={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="Revenue YTD" value={formatINR(practiceKpis.revenueYTD)} icon={TrendingUp} accent="#eab308" change={practiceKpis.revenueGrowth} />
          <Kpi label="On-time Filing" value={`${practiceKpis.onTimeFilingRate}%`} icon={Gauge} accent="#10b981" />
          <Kpi label="Avg Client Health" value="83/100" icon={HeartPulse} accent="#ef4444" />
          <Kpi label="Realization Rate" value={`${practiceKpis.realizationRate}%`} icon={Percent} accent="#6366f1" />
        </div>
      }
    />
  );
}
