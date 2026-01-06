-- AlterTable
ALTER TABLE "RewatchLog" ADD COLUMN     "recommendationLogId" TEXT;

-- CreateIndex
CREATE INDEX "RewatchLog_recommendationLogId_idx" ON "RewatchLog"("recommendationLogId");

-- AddForeignKey
ALTER TABLE "RewatchLog" ADD CONSTRAINT "RewatchLog_recommendationLogId_fkey" FOREIGN KEY ("recommendationLogId") REFERENCES "RecommendationLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
