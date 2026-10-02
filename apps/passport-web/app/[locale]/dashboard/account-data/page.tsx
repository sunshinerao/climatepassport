import { AccountDataScreen } from "@/components/data-governance-screens";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedAccountDataPage({ params }: { params: { locale: Locale } }) {
  await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/account-data`);
  return <AccountDataScreen locale={params.locale} />;
}
