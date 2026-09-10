-- CreateTable
CREATE TABLE "YandexMapsInfo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orgSlug" TEXT NOT NULL,
    "ratingValue" DOUBLE PRECISION,
    "ratingCount" INTEGER,
    "reviewCount" INTEGER,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YandexMapsInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YandexReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YandexReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YandexMapsInfo_projectId_key" ON "YandexMapsInfo"("projectId");

-- CreateIndex
CREATE INDEX "YandexReview_projectId_publishedAt_idx" ON "YandexReview"("projectId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "YandexReview_orgId_authorUserId_publishedAt_key" ON "YandexReview"("orgId", "authorUserId", "publishedAt");

-- AddForeignKey
ALTER TABLE "YandexMapsInfo" ADD CONSTRAINT "YandexMapsInfo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YandexReview" ADD CONSTRAINT "YandexReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
