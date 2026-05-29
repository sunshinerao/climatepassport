-- CreateTable
CREATE TABLE "activity_date_slots" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "scheduleDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_date_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_institutions" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "role" TEXT,
    "roleEn" TEXT,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_institutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_date_slots_activityId_idx" ON "activity_date_slots"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_date_slots_activityId_scheduleDate_key" ON "activity_date_slots"("activityId", "scheduleDate");

-- CreateIndex
CREATE INDEX "activity_institutions_activityId_order_idx" ON "activity_institutions"("activityId", "order");

-- CreateIndex
CREATE INDEX "activity_institutions_institutionId_idx" ON "activity_institutions"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_institutions_activityId_institutionId_key" ON "activity_institutions"("activityId", "institutionId");

-- AddForeignKey
ALTER TABLE "activity_date_slots" ADD CONSTRAINT "activity_date_slots_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_institutions" ADD CONSTRAINT "activity_institutions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_institutions" ADD CONSTRAINT "activity_institutions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
