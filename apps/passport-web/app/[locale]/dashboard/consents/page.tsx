import { ConsentsScreen } from "@/components/data-governance-screens";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedConsentsPage({ params }: { params: { locale: Locale } }) {
  await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/consents`);
  return <ConsentsScreen locale={params.locale} />;
}
