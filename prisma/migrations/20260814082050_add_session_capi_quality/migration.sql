-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "metaCapiError" TEXT,
ADD COLUMN     "metaCapiEvent" TEXT,
ADD COLUMN     "metaCapiQuality" TEXT,
ADD COLUMN     "metaCapiSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_sessionId_idx" ON "Lead"("sessionId");
