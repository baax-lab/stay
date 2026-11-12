-- DropIndex
DROP INDEX "Lead_phone_idx";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "phoneNorm" TEXT;

-- CreateIndex
CREATE INDEX "Lead_phoneNorm_idx" ON "Lead"("phoneNorm");
