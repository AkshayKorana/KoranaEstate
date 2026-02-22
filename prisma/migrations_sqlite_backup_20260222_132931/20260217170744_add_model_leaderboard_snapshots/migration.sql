-- CreateTable
CREATE TABLE "ModelLeaderboardSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commodityName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "mape" REAL,
    "mae" REAL,
    "rmse" REAL,
    "sampleCount" INTEGER NOT NULL,
    "windowStart" DATETIME,
    "windowEnd" DATETIME,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ModelLeaderboardSnapshot_commodityName_horizonDays_generatedAt_idx" ON "ModelLeaderboardSnapshot"("commodityName", "horizonDays", "generatedAt");

-- CreateIndex
CREATE INDEX "ModelLeaderboardSnapshot_modelVersion_horizonDays_generatedAt_idx" ON "ModelLeaderboardSnapshot"("modelVersion", "horizonDays", "generatedAt");
