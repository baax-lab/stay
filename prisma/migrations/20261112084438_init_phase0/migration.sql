-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LEITUNG', 'MITARBEITER', 'PRAKTIKANT');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('MESSE', 'AGENTUR', 'MULTIPLIKATOR', 'WEBSITE', 'EMPFEHLUNG', 'LINKEDIN', 'BESTAND', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEU', 'KONTAKTIERT', 'ERSTGESPRAECH', 'UMGEWANDELT', 'VERWORFEN');

-- CreateEnum
CREATE TYPE "LeadRole" AS ENUM ('KAEUFER', 'VERKAEUFER', 'PARTNER', 'MULTIPLIKATOR');

-- CreateEnum
CREATE TYPE "Segment" AS ENUM ('FEWO', 'APARTMENTHAUS', 'PENSION_HOTEL');

-- CreateEnum
CREATE TYPE "HubSync" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "hubContactId" TEXT,
    "hubSync" "HubSync" NOT NULL DEFAULT 'PENDING',
    "hubSyncError" TEXT,
    "hubSyncedAt" TIMESTAMP(3),
    "duplicateOfId" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "role" "LeadRole" NOT NULL DEFAULT 'KAEUFER',
    "source" "LeadSource" NOT NULL,
    "sourceDetail" TEXT,
    "referrerId" TEXT,
    "interest" TEXT,
    "segment" "Segment",
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "consentEmail" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEU',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "focus" BOOLEAN NOT NULL DEFAULT false,
    "licenseRule" TEXT,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_clientId_key" ON "Lead"("clientId");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Region_key_key" ON "Region"("key");

-- CreateIndex
CREATE INDEX "Region_country_idx" ON "Region"("country");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
