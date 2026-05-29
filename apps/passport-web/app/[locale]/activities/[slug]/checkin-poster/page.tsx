import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { issueQrToken } from "@/lib/server/qr";
import type { Locale } from "@/lib/site-content";
import { CheckinPosterClient } from "@/components/checkin-poster-client";
import QRCode from "qrcode";

export default async function ActivityCheckinPosterPage({
  params,
}: {
  params: { locale: Locale; slug: string };
}) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const activityRaw = await prisma.activity.findUnique({
    where: { slug: params.slug },
  });
  if (!activityRaw) notFound();

  const activity = activityRaw as typeof activityRaw & {
    posterImage?: string | null;
    locationJson?: Record<string, string> | null;
  };

  const zh = params.locale === "zh";
  const title = zh ? activity.title : (activity.titleEn ?? activity.title);
  const locationJson = activity.locationJson as Record<string, string> | null;
  const venue = zh
    ? (locationJson?.venue ?? "")
    : (locationJson?.venueEn ?? locationJson?.venue ?? "");
  const city = zh
    ? (locationJson?.city ?? "")
    : (locationJson?.cityEn ?? locationJson?.city ?? "");

  // Verify participation
  const participation = await prisma.activityParticipation.findUnique({
    where: { activityId_userId: { activityId: activity.id, userId: user.id } },
    select: { id: true, status: true },
  }).catch(() => null);

  let qrDataUrl: string | null = null;
  if (participation && !["ARCHIVED", "ABSENT", "FAILED"].includes(participation.status)) {
    try {
      const qr = await issueQrToken({
        type: "ACTIVITY_CHECKIN",
        userId: user.id,
        activityId: activity.id,
        subjectType: "activity_participation",
        subjectId: participation.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        scopeJson: { actions: ["activity_checkin"] },
      });
      qrDataUrl = await QRCode.toDataURL(qr.token, { margin: 2, width: 300 });
    } catch {
      qrDataUrl = null;
    }
  }

  const profileRaw = await (prisma as any).userProfile?.findUnique?.({
    where: { userId: user.id },
    select: { displayName: true, avatarUrl: true, passportId: true },
  }).catch(() => null);

  const profile = profileRaw as { displayName?: string; passportId?: string } | null;

  return (
    <CheckinPosterClient
      locale={params.locale}
      qrDataUrl={qrDataUrl}
      hasParticipation={!!participation}
      activityData={{
        title,
        posterImage: (activity as any).posterImage ?? null,
        startTime: activity.startTime ? activity.startTime.toISOString() : null,
        endTime: activity.endTime ? activity.endTime.toISOString() : null,
        venue,
        city,
      }}
      userData={{
        displayName: profile?.displayName ?? user.name ?? user.email ?? "",
        passportId: profile?.passportId ?? "",
      }}
    />
  );
}
