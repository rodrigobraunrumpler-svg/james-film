-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "availabilityUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BusyDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusyDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusyDay_date_key" ON "BusyDay"("date");

-- CreateIndex
CREATE INDEX "BusyDay_groupId_idx" ON "BusyDay"("groupId");
