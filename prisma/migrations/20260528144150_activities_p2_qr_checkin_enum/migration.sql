-- AlterEnum
ALTER TYPE "QrTokenType" ADD VALUE 'ACTIVITY_CHECKIN';

-- AddForeignKey
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
