import { redirect } from "next/navigation";

// The customer dashboard lives at /customer. This alias keeps the
// spec'd /customer/dashboard path working (and any deep links to it).
export default function CustomerDashboardAlias() {
  redirect("/customer");
}
