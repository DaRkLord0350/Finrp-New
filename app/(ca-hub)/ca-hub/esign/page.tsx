import { PenLine, CheckCircle2, Fingerprint, KeyRound } from "lucide-react";
import { ModuleLanding, Kpi } from "@/components/ca-hub/ui";

export default function EsignCenter() {
  return (
    <ModuleLanding
      slug="esign"
      kpis={
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <Kpi label="Pending Signatures" value={17} icon={PenLine} accent="#a855f7" sub="in queue" />
          <Kpi label="Signed (FY)" value={340} icon={CheckCircle2} accent="#10b981" />
          <Kpi label="Aadhaar eSign" value={210} icon={Fingerprint} accent="#6366f1" sub="OTP-based" />
          <Kpi label="DSC Signed" value={130} icon={KeyRound} accent="#f59e0b" sub="token + cloud" />
        </div>
      }
    />
  );
}
