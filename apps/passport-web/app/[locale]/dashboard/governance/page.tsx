import { GovernanceWorkbench } from "@/components/governance-workbench";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";

export default async function GovernancePage({ params }: { params: { locale: Locale } }) {
  await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/governance`);
  return <GovernanceWorkbench locale={params.locale} />;
}