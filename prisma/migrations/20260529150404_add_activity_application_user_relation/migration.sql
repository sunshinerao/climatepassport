-- AddForeignKey
ALTER TABLE "activity_applications" ADD CONSTRAINT "activity_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
