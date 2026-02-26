-- CreateTable
CREATE TABLE "PersonProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personType" TEXT NOT NULL,
    "topPersons" JSONB NOT NULL DEFAULT '[]',
    "totalMoviesAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computationMethod" TEXT NOT NULL DEFAULT 'full',

    CONSTRAINT "PersonProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoviePersonCache" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "mediaType" TEXT NOT NULL,
    "topActors" JSONB NOT NULL DEFAULT '[]',
    "topDirectors" JSONB NOT NULL DEFAULT '[]',
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoviePersonCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonProfile_userId_idx" ON "PersonProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonProfile_userId_personType_key" ON "PersonProfile"("userId", "personType");

-- CreateIndex
CREATE INDEX "MoviePersonCache_tmdbId_idx" ON "MoviePersonCache"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "MoviePersonCache_tmdbId_mediaType_key" ON "MoviePersonCache"("tmdbId", "mediaType");

-- AddForeignKey
ALTER TABLE "PersonProfile" ADD CONSTRAINT "PersonProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
