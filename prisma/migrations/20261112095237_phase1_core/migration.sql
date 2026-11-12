-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('ERSTGESPRAECH', 'BEAUFTRAGT', 'ANALYSE', 'SUCHE', 'PRUEFUNG', 'VERHANDLUNG', 'GEKAUFT', 'NACHBETREUUNG', 'ABGESCHLOSSEN', 'PAUSIERT', 'BEENDET_OHNE_KAUF');

-- CreateEnum
CREATE TYPE "UsageGoal" AS ENUM ('RENDITE', 'EIGENNUTZUNG', 'KOMBINIERT', 'EIGENBETRIEB');

-- CreateEnum
CREATE TYPE "ObjectSource" AS ENUM ('PARTNER', 'AGENTUR', 'PORTAL', 'OFFMARKET', 'DIREKT');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('VORHANDEN', 'BEANTRAGT', 'FEHLT', 'UNKLAR', 'NICHT_NOETIG');

-- CreateEnum
CREATE TYPE "LicenseLight" AS ENUM ('GRUEN', 'GELB', 'ROT', 'GRAU');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('VERFUEGBAR', 'RESERVIERT', 'VERKAUFT', 'ZURUECKGEZOGEN');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('NEU', 'GEPRUEFT', 'AN_KAEUFER', 'ABGELEHNT', 'GEMERKT', 'GESCHLOSSEN');

-- CreateEnum
CREATE TYPE "ReferrerType" AS ENUM ('TIPPGEBER', 'AGENTUR', 'MULTIPLIKATOR', 'PARTNER');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('MAKLER', 'AGENTUR', 'ANWALT', 'NOTAR', 'FINANZIERER', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "OfferResponse" AS ENUM ('OFFEN', 'ANGENOMMEN', 'ABGELEHNT', 'GEGENANGEBOT');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('SUCHAUFTRAG', 'GWG_NACHWEIS', 'FINANZIERUNG', 'VOLLMACHT', 'SONSTIGES');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "followUpTaskAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Mandate" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "hubContactId" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "title" TEXT NOT NULL,
    "status" "MandateStatus" NOT NULL DEFAULT 'ERSTGESPRAECH',
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "endReason" TEXT,
    "statusBeforePause" "MandateStatus",
    "contractSignedAt" TIMESTAMP(3),
    "gwgIdentifiedAt" TIMESTAMP(3),
    "gwgIdentType" TEXT,
    "interviewNotes" JSONB,
    "assessment" TEXT,
    "referrerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchProfile" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "segments" "Segment"[],
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceMin" INTEGER,
    "priceMax" INTEGER NOT NULL,
    "usageGoal" "UsageGoal" NOT NULL DEFAULT 'RENDITE',
    "minUnits" INTEGER,
    "maxUnits" INTEGER,
    "licenseRequired" BOOLEAN NOT NULL DEFAULT true,
    "mustCriteria" JSONB NOT NULL DEFAULT '[]',
    "wishCriteria" JSONB NOT NULL DEFAULT '[]',
    "financing" TEXT,
    "horizon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "segment" "Segment" NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "locality" TEXT,
    "address" TEXT,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "units" INTEGER,
    "livingArea" INTEGER,
    "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'UNKLAR',
    "licenseNote" TEXT,
    "licenseLight" "LicenseLight" NOT NULL DEFAULT 'GRAU',
    "occupancyPct" DOUBLE PRECISION,
    "adr" INTEGER,
    "revenueYear" INTEGER,
    "features" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "source" "ObjectSource" NOT NULL,
    "sourceDetail" TEXT,
    "knownSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "knownSourceNote" TEXT,
    "sellerLeadId" TEXT,
    "offmarket" BOOLEAN NOT NULL DEFAULT false,
    "referrerId" TEXT,
    "partnerId" TEXT,
    "availability" "Availability" NOT NULL DEFAULT 'VERFUEGBAR',
    "priceHistory" JSONB NOT NULL DEFAULT '[]',
    "documents" JSONB NOT NULL DEFAULT '[]',
    "photos" JSONB NOT NULL DEFAULT '[]',
    "duplicateOfId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "nearMiss" BOOLEAN NOT NULL DEFAULT false,
    "reasons" JSONB NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'NEU',
    "rejectReason" TEXT,
    "viewingAt" TIMESTAMP(3),
    "viewingNote" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presentation" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "askingPrice" INTEGER NOT NULL,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "priorKnowledge" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeBand" (
    "id" TEXT NOT NULL,
    "volumeFrom" INTEGER NOT NULL,
    "volumeTo" INTEGER,
    "baseFee" INTEGER NOT NULL,
    "successFee" INTEGER NOT NULL,
    "bonusPct" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "bonusCapPct" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "note" TEXT,

    CONSTRAINT "FeeBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAgreement" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "volumeBandId" TEXT,
    "baseFeeActive" BOOLEAN NOT NULL DEFAULT false,
    "baseFee" INTEGER NOT NULL DEFAULT 0,
    "successFee" INTEGER NOT NULL DEFAULT 0,
    "bonusPct" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "bonusCapPct" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "travelFlat" INTEGER,
    "sellerSideCommission" INTEGER,
    "sellerSideCredited" INTEGER,
    "note" TEXT,
    "purchasePrice" INTEGER,
    "askingPrice" INTEGER,
    "bonusAmount" INTEGER,
    "invoicedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MandateEvent" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MandateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referrer" (
    "id" TEXT NOT NULL,
    "hubContactId" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "type" "ReferrerType" NOT NULL,
    "rewardRule" TEXT,
    "rewardPct" DOUBLE PRECISION,
    "rewardFlat" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referrer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "basis" TEXT,
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "hubContactId" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "language" TEXT NOT NULL DEFAULT 'de',
    "type" "PartnerType" NOT NULL DEFAULT 'MAKLER',
    "country" TEXT NOT NULL,
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "licenseNote" TEXT,
    "commissionSplit" TEXT,
    "agreementAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerSend" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "repliedAt" TIMESTAMP(3),
    "replyNote" TEXT,

    CONSTRAINT "PartnerSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "madeAt" TIMESTAMP(3) NOT NULL,
    "conditions" TEXT,
    "response" "OfferResponse" NOT NULL DEFAULT 'OFFEN',
    "counterAmount" INTEGER,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Closing" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "notaryDate" TIMESTAMP(3),
    "handoverDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Closing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "feedback" TEXT,
    "referralGiven" BOOLEAN NOT NULL DEFAULT false,
    "nextMandateWanted" BOOLEAN NOT NULL DEFAULT false,
    "hubTaskAt" TIMESTAMP(3),

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MandateDocument" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "fileId" TEXT NOT NULL,
    "label" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MandateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mandate_leadId_key" ON "Mandate"("leadId");

-- CreateIndex
CREATE INDEX "Mandate_status_idx" ON "Mandate"("status");

-- CreateIndex
CREATE INDEX "Mandate_ownerId_idx" ON "Mandate"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchProfile_mandateId_key" ON "SearchProfile"("mandateId");

-- CreateIndex
CREATE INDEX "Property_country_region_idx" ON "Property"("country", "region");

-- CreateIndex
CREATE INDEX "Property_segment_idx" ON "Property"("segment");

-- CreateIndex
CREATE INDEX "Property_availability_idx" ON "Property"("availability");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE INDEX "Match_notifiedAt_idx" ON "Match"("notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Match_mandateId_propertyId_key" ON "Match"("mandateId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Presentation_mandateId_propertyId_key" ON "Presentation"("mandateId", "propertyId");

-- CreateIndex
CREATE INDEX "FeeBand_volumeFrom_idx" ON "FeeBand"("volumeFrom");

-- CreateIndex
CREATE UNIQUE INDEX "FeeAgreement_mandateId_key" ON "FeeAgreement"("mandateId");

-- CreateIndex
CREATE INDEX "MandateEvent_mandateId_createdAt_idx" ON "MandateEvent"("mandateId", "createdAt");

-- CreateIndex
CREATE INDEX "Offer_mandateId_madeAt_idx" ON "Offer"("mandateId", "madeAt");

-- CreateIndex
CREATE UNIQUE INDEX "Closing_mandateId_key" ON "Closing"("mandateId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storedName_key" ON "StoredFile"("storedName");

-- CreateIndex
CREATE INDEX "StoredFile_entity_entityId_idx" ON "StoredFile"("entity", "entityId");

-- CreateIndex
CREATE INDEX "SavedView_userId_scope_idx" ON "SavedView"("userId", "scope");

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchProfile" ADD CONSTRAINT "SearchProfile_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_sellerLeadId_fkey" FOREIGN KEY ("sellerLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAgreement" ADD CONSTRAINT "FeeAgreement_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandateEvent" ADD CONSTRAINT "MandateEvent_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSend" ADD CONSTRAINT "PartnerSend_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerSend" ADD CONSTRAINT "PartnerSend_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Closing" ADD CONSTRAINT "Closing_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandateDocument" ADD CONSTRAINT "MandateDocument_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
