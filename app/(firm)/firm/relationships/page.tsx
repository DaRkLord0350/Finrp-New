import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getCaDirectory, getCaDetail } from "@/lib/firm/relationships";
import { RelationshipsClient } from "@/components/firm/relationships/RelationshipsClient";

export const dynamic = "force-dynamic";

export default async function RelationshipsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/sign-in");
  if (user.userRole !== "CA_FIRM_ADMIN") redirect("/dashboard");

  const directory = await getCaDirectory(user.organizationId);
  const initialDetail = directory.length
    ? await getCaDetail(user.organizationId, directory[0].id)
    : null;

  return <RelationshipsClient directory={directory} initialDetail={initialDetail} />;
}
