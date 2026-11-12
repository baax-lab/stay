-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('ENTWURF', 'ABGESCHLOSSEN');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('EMPFEHLEN', 'BEDINGT', 'NICHT_EMPFEHLEN');

-- CreateEnum
CREATE TYPE "PrecheckStatus" AS ENUM ('OFFEN', 'LAEUFT', 'OK', 'BEDENKEN', 'KO');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "submittedViaAccessId" TEXT;

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "mandateId" TEXT,
    "tripId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendees" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'ENTWURF',
    "rating" INTEGER,
    "recommendation" "Recommendation",
    "items" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destination" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "travelers" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripCost" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Precheck" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "status" "PrecheckStatus" NOT NULL DEFAULT 'OFFEN',
    "items" JSONB NOT NULL,
    "summary" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Precheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAccess" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "mandateId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerRating" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "mandateId" TEXT,
    "reliability" INTEGER NOT NULL,
    "quality" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "comment" TEXT,
    "ratedById" TEXT NOT NULL,
    "ratedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'de',
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Criterion" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelEn" TEXT,
    "group" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inspection_propertyId_idx" ON "Inspection"("propertyId");

-- CreateIndex
CREATE INDEX "Inspection_mandateId_idx" ON "Inspection"("mandateId");

-- CreateIndex
CREATE INDEX "Trip_mandateId_idx" ON "Trip"("mandateId");

-- CreateIndex
CREATE UNIQUE INDEX "Precheck_propertyId_key" ON "Precheck"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAccess_tokenHash_key" ON "PartnerAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "PartnerAccess_partnerId_idx" ON "PartnerAccess"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerRating_partnerId_idx" ON "PartnerRating"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_kind_lang_key" ON "DocumentTemplate"("kind", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_key_key" ON "ReminderLog"("key");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCost" ADD CONSTRAINT "TripCost_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Precheck" ADD CONSTRAINT "Precheck_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAccess" ADD CONSTRAINT "PartnerAccess_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerRating" ADD CONSTRAINT "PartnerRating_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerRating" ADD CONSTRAINT "PartnerRating_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
