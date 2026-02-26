-- CreateTable
CREATE TABLE "SimilarityScore" (
    "id" TEXT NOT NULL,
    "userIdA" TEXT NOT NULL,
    "userIdB" TEXT NOT NULL,
    "overallMatch" DECIMAL(5,4) NOT NULL,
    "tasteSimilarity" DECIMAL(5,4) NOT NULL,
    "ratingCorrelation" DECIMAL(6,4) NOT NULL,
    "personOverlap" DECIMAL(5,4) NOT NULL,
    "tasteMapASnapshot" JSONB NOT NULL,
    "tasteMapBSnapshot" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "computedBy" TEXT NOT NULL,

    CONSTRAINT "SimilarityScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimilarityScore_userIdA_idx" ON "SimilarityScore"("userIdA");

-- CreateIndex
CREATE INDEX "SimilarityScore_userIdB_idx" ON "SimilarityScore"("userIdB");

-- CreateIndex
CREATE INDEX "SimilarityScore_computedAt_idx" ON "SimilarityScore"("computedAt");

-- CreateIndex
CREATE INDEX "SimilarityScore_updatedAt_idx" ON "SimilarityScore"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SimilarityScore_userIdA_userIdB_key" ON "SimilarityScore"("userIdA", "userIdB");
