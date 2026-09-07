-- AlterTable
ALTER TABLE "WhatsappClick" ADD COLUMN     "requestedDate" DATE;

-- CreateIndex
CREATE INDEX "WhatsappClick_source_requestedDate_idx" ON "WhatsappClick"("source", "requestedDate");
