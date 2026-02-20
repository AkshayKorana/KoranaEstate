-- CreateTable
CREATE TABLE "ForecastRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commodityName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "mape" REAL,
    "mae" REAL,
    "rmse" REAL,
    "trendText" TEXT NOT NULL,
    "pctMove" REAL,
    "lowerPct" REAL,
    "upperPct" REAL,
    "labelsJson" TEXT NOT NULL,
    "actualJson" TEXT NOT NULL,
    "forecastJson" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ForecastRun_commodityName_generatedAt_idx" ON "ForecastRun"("commodityName", "generatedAt");

-- CreateIndex
CREATE INDEX "ForecastRun_modelVersion_generatedAt_idx" ON "ForecastRun"("modelVersion", "generatedAt");
