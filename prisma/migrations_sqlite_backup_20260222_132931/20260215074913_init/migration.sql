/*
  Warnings:

  - You are about to alter the column `pricePerKg` on the `Coffee` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Coffee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coffeeType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerKg" REAL NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Coffee" ("coffeeType", "createdAt", "description", "id", "location", "pricePerKg", "quantity") SELECT "coffeeType", "createdAt", "description", "id", "location", "pricePerKg", "quantity" FROM "Coffee";
DROP TABLE "Coffee";
ALTER TABLE "new_Coffee" RENAME TO "Coffee";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
