-- AlterTable
ALTER TABLE "WatchList" ADD COLUMN "weightedRating" DOUBLE PRECISION;

-- CreateIndex
-- В Prisma индексы обычно именуются так, если не указано иное
CREATE INDEX "WatchList_weightedRating_key" ON "WatchList"("weightedRating");