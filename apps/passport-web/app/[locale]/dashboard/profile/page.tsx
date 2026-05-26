import { ProfileMaintenanceScreen } from "@/components/platform-screens";
import type { Locale } from "@/lib/site-content";

export default function LocalizedProfileMaintenancePage({ params }: { params: { locale: Locale } }) {
  return <ProfileMaintenanceScreen locale={params.locale} />;
}
