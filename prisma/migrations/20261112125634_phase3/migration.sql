-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('NEU', 'UEBERNOMMEN', 'VERWORFEN');

-- AlterTable
ALTER TABLE "Region" ADD COLUMN     "adrMax" INTEGER,
ADD COLUMN     "adrMin" INTEGER,
ADD COLUMN     "airportNote" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "occupancyMax" DOUBLE PRECISION,
ADD COLUMN     "occupancyMin" DOUBLE PRECISION,
ADD COLUMN     "pricePerSqmMax" INTEGER,
ADD COLUMN     "pricePerSqmMin" INTEGER,
ADD COLUMN     "rentalRules" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByName" TEXT,
ADD COLUMN     "risks" TEXT,
ADD COLUMN     "seasonality" TEXT,
ADD COLUMN     "secondHomeRules" TEXT,
ADD COLUMN     "sources" TEXT,
ADD COLUMN     "taxNote" TEXT;

-- CreateTable
CREATE TABLE "Country" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "overview" TEXT,
    "buyingProcess" TEXT,
    "foreignBuyers" TEXT,
    "taxesNote" TEXT,
    "typicalDuration" TEXT,
    "financingNote" TEXT,
    "sources" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "PortalSearch" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segments" "Segment"[],
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceMin" INTEGER,
    "priceMax" INTEGER NOT NULL,
    "minUnits" INTEGER,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchCandidate" (
    "id" TEXT NOT NULL,
    "portalSearchId" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'NEU',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalSearch_mandateId_idx" ON "PortalSearch"("mandateId");

-- CreateIndex
CREATE INDEX "SearchCandidate_mandateId_status_idx" ON "SearchCandidate"("mandateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SearchCandidate_portalSearchId_propertyId_key" ON "SearchCandidate"("portalSearchId", "propertyId");

-- AddForeignKey
ALTER TABLE "PortalSearch" ADD CONSTRAINT "PortalSearch_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchCandidate" ADD CONSTRAINT "SearchCandidate_portalSearchId_fkey" FOREIGN KEY ("portalSearchId") REFERENCES "PortalSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchCandidate" ADD CONSTRAINT "SearchCandidate_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchCandidate" ADD CONSTRAINT "SearchCandidate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
