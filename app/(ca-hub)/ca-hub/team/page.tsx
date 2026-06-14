import { UsersRound, Gauge, Clock, ClipboardList } from "lucide-react";
import { ModuleLanding, Kpi } from "@/components/ca-hub/ui";
import { teamProductivity, practiceKpis } from "@/lib/ca-hub/demo-data";

export default function TeamManagement() {
  const billable = teamProductivity.reduce((s, t) => s + t.billable, 0);
  return (
    <ModuleLanding
      slug="team"
      kpis={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="Team Members" value={teamProductivity.length} icon={UsersRound} accent="#22c55e" />
          <Kpi label="Avg Utilization" value={`${practiceKpis.teamUtilization}%`} icon={Gauge} accent="#0ea5e9" />
          <Kpi label="Billable Hours" value={billable} icon={Clock} accent="#6366f1" sub="this month" />
          <Kpi label="Open Tasks" value={47} icon={ClipboardList} accent="#f59e0b" />
        </div>
      }
    />
  );
}
