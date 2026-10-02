import { RecordsScreen } from "@/components/data-governance-screens";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedRecordsPage({ params }: { params: { locale: Locale } }) {
  await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/records`);
  return <RecordsScreen locale={params.locale} />;
}
