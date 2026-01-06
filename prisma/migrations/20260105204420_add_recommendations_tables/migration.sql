-- CreateTable
CREATE TABLE "RecommendationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "action" TEXT,
    "context" JSONB,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationSettings" (
    "userId" TEXT NOT NULL,
    "preferHighRating" BOOLEAN NOT NULL DEFAULT true,
    "avoidRewatches" BOOLEAN NOT NULL DEFAULT false,
    "preferUnwatched" BOOLEAN NOT NULL DEFAULT true,
    "noveltyWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "randomnessWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "RecommendationLog_userId_shownAt_idx" ON "RecommendationLog"("userId", "shownAt");

-- CreateIndex
CREATE INDEX "RecommendationLog_userId_tmdbId_mediaType_idx" ON "RecommendationLog"("userId", "tmdbId", "mediaType");

-- AddForeignKey
ALTER TABLE "RecommendationLog" ADD CONSTRAINT "RecommendationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationSettings" ADD CONSTRAINT "RecommendationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
