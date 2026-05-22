import { RegisterScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedRegisterPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { next?: string };
}) {
  return <RegisterScreen locale={params.locale} nextPath={searchParams?.next} />;
}