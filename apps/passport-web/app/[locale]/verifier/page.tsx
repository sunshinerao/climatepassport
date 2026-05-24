import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { loadVerifiableEvents } from "@/lib/server/verifier";
import { VerifierScanner } from "@/components/verifier-scanner";
import type { Locale } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function VerifierConsolePage({ params }: { params: { locale: Locale } }) {
  noStore();
  const verifier = await requireRoleAccess(
    params.locale,
    ["ADMIN", "EVENT_MANAGER", "VERIFIER"],
    `/${params.locale}/verifier`,
  );

  const events = await loadVerifiableEvents(verifier);

  return (
    <VerifierScanner
      locale={params.locale}
      verifierName={verifier.name}
      events={events.map((event) => ({
        id: event.id,
        title: event.title,
        titleEn: event.titleEn,
        startDate: event.startDate.toISOString(),
      }))}
    />
  );
}
