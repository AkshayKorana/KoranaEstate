-- CreateTable
CREATE TABLE "Coffee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coffeeType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerKg" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
