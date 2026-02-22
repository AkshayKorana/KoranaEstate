-- CreateTable
CREATE TABLE "Commodity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variety" TEXT,
    "price" REAL NOT NULL,
    "location" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Commodity_name_variety_idx" ON "Commodity"("name", "variety");
