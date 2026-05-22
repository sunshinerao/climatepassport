import { LoginScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedLoginPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { next?: string };
}) {
  return <LoginScreen locale={params.locale} nextPath={searchParams?.next} />;
}