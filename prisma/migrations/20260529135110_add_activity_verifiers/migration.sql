-- CreateTable
CREATE TABLE "activity_verifiers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_verifiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_verifiers_userId_idx" ON "activity_verifiers"("userId");

-- CreateIndex
CREATE INDEX "activity_verifiers_activityId_idx" ON "activity_verifiers"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_verifiers_userId_activityId_key" ON "activity_verifiers"("userId", "activityId");

-- AddForeignKey
ALTER TABLE "activity_verifiers" ADD CONSTRAINT "activity_verifiers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_verifiers" ADD CONSTRAINT "activity_verifiers_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
