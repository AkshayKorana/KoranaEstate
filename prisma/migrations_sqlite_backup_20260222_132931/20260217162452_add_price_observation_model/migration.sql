-- CreateTable
CREATE TABLE "PriceObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commodityName" TEXT NOT NULL,
    "grade" TEXT,
    "priceType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "marketCenter" TEXT,
    "unit" TEXT NOT NULL,
    "inrPerKg" REAL NOT NULL,
    "observedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PriceObservation_commodityName_priceType_observedAt_idx" ON "PriceObservation"("commodityName", "priceType", "observedAt");

-- CreateIndex
CREATE INDEX "PriceObservation_source_observedAt_idx" ON "PriceObservation"("source", "observedAt");
