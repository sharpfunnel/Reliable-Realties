-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "metaAdId" TEXT,
ADD COLUMN     "metaAdsetId" TEXT,
ADD COLUMN     "metaCampaignId" TEXT,
ADD COLUMN     "placement" TEXT,
ADD COLUMN     "rawParams" JSONB;

-- CreateIndex
CREATE INDEX "Session_metaCampaignId_idx" ON "Session"("metaCampaignId");
