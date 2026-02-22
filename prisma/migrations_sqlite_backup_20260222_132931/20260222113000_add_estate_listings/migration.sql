-- CreateTable
CREATE TABLE "EstateListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "listingType" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" REAL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EstateListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EstateListing_category_listingType_isActive_createdAt_idx" ON "EstateListing"("category", "listingType", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "EstateListing_sellerId_isActive_idx" ON "EstateListing"("sellerId", "isActive");

-- CreateIndex
CREATE INDEX "EstateListing_location_category_idx" ON "EstateListing"("location", "category");
