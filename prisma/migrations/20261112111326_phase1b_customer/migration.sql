-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('SUCHBERICHT', 'MARKTBERICHT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('ENTWURF', 'FREIGEGEBEN');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('OBJEKT', 'BERICHT', 'STATUS', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('ENTWURF', 'GESENDET', 'VERWORFEN');

-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "buyerLang" TEXT NOT NULL DEFAULT 'de',
ADD COLUMN     "ownerPhone" TEXT,
ADD COLUMN     "ownerPhotoFileId" TEXT,
ADD COLUMN     "portalNextSteps" TEXT;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "buyerAction" TEXT,
ADD COLUMN     "buyerActionAt" TIMESTAMP(3),
ADD COLUMN     "buyerReasonCategory" TEXT,
ADD COLUMN     "buyerReasonText" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "managementPct" DOUBLE PRECISION,
ADD COLUMN     "opCostsYear" INTEGER,
ADD COLUMN     "precheckNote" TEXT,
ADD COLUMN     "renovationBudget" INTEGER,
ADD COLUMN     "reservesPct" DOUBLE PRECISION,
ADD COLUMN     "risks" TEXT,
ADD COLUMN     "risksEn" TEXT,
ADD COLUMN     "scenarioSpread" DOUBLE PRECISION,
ADD COLUMN     "strengths" TEXT,
ADD COLUMN     "strengthsEn" TEXT,
ADD COLUMN     "taxPct" DOUBLE PRECISION,
ADD COLUMN     "titleEn" TEXT;

-- CreateTable
CREATE TABLE "CountryCost" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "regionKey" TEXT,
    "label" TEXT NOT NULL,
    "pct" DOUBLE PRECISION,
    "flat" INTEGER,
    "note" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rateToEur" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manuell',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAccess" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "sentTo" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'ENTWURF',
    "title" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "content" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerNotification" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'ENTWURF',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "sentTo" TEXT,

    CONSTRAINT "BuyerNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CountryCost_country_regionKey_idx" ON "CountryCost"("country", "regionKey");

-- CreateIndex
CREATE INDEX "FxRate_currency_fetchedAt_idx" ON "FxRate"("currency", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccess_tokenHash_key" ON "PortalAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalAccess_mandateId_idx" ON "PortalAccess"("mandateId");

-- CreateIndex
CREATE INDEX "Report_mandateId_kind_idx" ON "Report"("mandateId", "kind");

-- CreateIndex
CREATE INDEX "BuyerNotification_mandateId_status_idx" ON "BuyerNotification"("mandateId", "status");

-- AddForeignKey
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerNotification" ADD CONSTRAINT "BuyerNotification_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
