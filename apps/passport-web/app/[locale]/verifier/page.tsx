import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { loadVerifiableEvents } from "@/lib/server/verifier";
import { loadVerifiableActivities } from "@/lib/server/verifier-activity";
import { VerifierScanner } from "@/components/verifier-scanner";
import type { Locale } from "@/lib/site-content";
import { privatePageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata;

export default async function VerifierConsolePage({ params }: { params: { locale: Locale } }) {
  noStore();
  const verifier = await requireRoleAccess(
    params.locale,
    ["ADMIN", "EVENT_MANAGER", "VERIFIER"],
    `/${params.locale}/verifier`,
  );

  const [legacyEvents, activities] = await Promise.all([
    loadVerifiableEvents(verifier),
    loadVerifiableActivities(verifier),
  ]);

  const allEvents = [
    ...legacyEvents.map((event) => ({
      id: event.id,
      title: event.title,
      titleEn: event.titleEn,
      startDate: event.startDate.toISOString(),
    })),
    ...activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      titleEn: activity.titleEn,
      startDate: activity.startTime ? activity.startTime.toISOString() : new Date().toISOString(),
    })),
  ];

  return (
    <VerifierScanner
      locale={params.locale}
      verifierName={verifier.name}
      events={allEvents}
    />
  );
}
