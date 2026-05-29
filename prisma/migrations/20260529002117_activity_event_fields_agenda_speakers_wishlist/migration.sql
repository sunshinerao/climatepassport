-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "eventLayer" "EventLayer",
ADD COLUMN     "highlights" JSONB,
ADD COLUMN     "highlightsEn" JSONB,
ADD COLUMN     "hostType" "EventHostType",
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mapUrl" TEXT,
ADD COLUMN     "posterImage" TEXT,
ADD COLUMN     "trackId" TEXT;

-- CreateTable
CREATE TABLE "activity_agenda_items" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "agendaDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "type" TEXT NOT NULL DEFAULT 'session',
    "venue" TEXT,
    "venueEn" TEXT,
    "moderatorId" TEXT,
    "speakerMeta" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_agenda_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_agenda_item_speakers" (
    "id" TEXT NOT NULL,
    "agendaItemId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_agenda_item_speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_speakers" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "role" TEXT,
    "roleEn" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_wishlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_agenda_items_activityId_idx" ON "activity_agenda_items"("activityId");

-- CreateIndex
CREATE INDEX "activity_agenda_items_activityId_agendaDate_idx" ON "activity_agenda_items"("activityId", "agendaDate");

-- CreateIndex
CREATE INDEX "activity_agenda_items_moderatorId_idx" ON "activity_agenda_items"("moderatorId");

-- CreateIndex
CREATE INDEX "activity_agenda_item_speakers_agendaItemId_idx" ON "activity_agenda_item_speakers"("agendaItemId");

-- CreateIndex
CREATE INDEX "activity_agenda_item_speakers_speakerId_idx" ON "activity_agenda_item_speakers"("speakerId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_agenda_item_speakers_agendaItemId_speakerId_key" ON "activity_agenda_item_speakers"("agendaItemId", "speakerId");

-- CreateIndex
CREATE INDEX "activity_speakers_activityId_idx" ON "activity_speakers"("activityId");

-- CreateIndex
CREATE INDEX "activity_speakers_speakerId_idx" ON "activity_speakers"("speakerId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_speakers_activityId_speakerId_key" ON "activity_speakers"("activityId", "speakerId");

-- CreateIndex
CREATE INDEX "activity_wishlists_userId_idx" ON "activity_wishlists"("userId");

-- CreateIndex
CREATE INDEX "activity_wishlists_activityId_idx" ON "activity_wishlists"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_wishlists_userId_activityId_key" ON "activity_wishlists"("userId", "activityId");

-- CreateIndex
CREATE INDEX "activities_trackId_idx" ON "activities"("trackId");

-- CreateIndex
CREATE INDEX "activities_isPinned_startTime_idx" ON "activities"("isPinned", "startTime");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_agenda_items" ADD CONSTRAINT "activity_agenda_items_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_agenda_items" ADD CONSTRAINT "activity_agenda_items_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_agenda_item_speakers" ADD CONSTRAINT "activity_agenda_item_speakers_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "activity_agenda_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_agenda_item_speakers" ADD CONSTRAINT "activity_agenda_item_speakers_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "speakers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_speakers" ADD CONSTRAINT "activity_speakers_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_speakers" ADD CONSTRAINT "activity_speakers_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "speakers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_wishlists" ADD CONSTRAINT "activity_wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_wishlists" ADD CONSTRAINT "activity_wishlists_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
