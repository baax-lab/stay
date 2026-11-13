-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "callbackAt" TIMESTAMP(3),
ADD COLUMN     "contactChannel" TEXT,
ADD COLUMN     "financing" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "timeHorizon" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "bathrooms" INTEGER,
ADD COLUMN     "bedrooms" INTEGER,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "distanceAirportKm" INTEGER,
ADD COLUMN     "distanceBeachM" INTEGER,
ADD COLUMN     "distanceSkiM" INTEGER,
ADD COLUMN     "energyClass" TEXT,
ADD COLUMN     "mapUrl" TEXT,
ADD COLUMN     "plotArea" INTEGER,
ADD COLUMN     "yearBuilt" INTEGER;
