-- CreateEnum
CREATE TYPE "PriceRunStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "PriceObservationStatus" AS ENUM ('OK', 'FAILED');

-- CreateTable
CREATE TABLE "PriceProduct" (
    "id" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'INR/kg',
    "defaultSource" TEXT,
    "sourceUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "baselineValue" DOUBLE PRECISION,
    "volatilityPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceIngestionRun" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "status" "PriceRunStatus" NOT NULL,
    "totalProducts" INTEGER NOT NULL,
    "successfulCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,
    "trigger" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceIngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceObservation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "status" "PriceObservationStatus" NOT NULL DEFAULT 'OK',
    "value" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "source" TEXT,
    "sourceUrl" TEXT,
    "confidence" DOUBLE PRECISION,
    "rawText" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceProduct_productKey_key" ON "PriceProduct"("productKey");

-- CreateIndex
CREATE INDEX "PriceProduct_enabled_displayOrder_idx" ON "PriceProduct"("enabled", "displayOrder");

-- CreateIndex
CREATE INDEX "PriceIngestionRun_runAt_createdAt_idx" ON "PriceIngestionRun"("runAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceObservation_runId_productKey_key" ON "PriceObservation"("runId", "productKey");

-- CreateIndex
CREATE INDEX "PriceObservation_productKey_capturedAt_idx" ON "PriceObservation"("productKey", "capturedAt");

-- CreateIndex
CREATE INDEX "PriceObservation_productId_capturedAt_idx" ON "PriceObservation"("productId", "capturedAt");

-- CreateIndex
CREATE INDEX "PriceObservation_runId_idx" ON "PriceObservation"("runId");

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PriceIngestionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PriceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
