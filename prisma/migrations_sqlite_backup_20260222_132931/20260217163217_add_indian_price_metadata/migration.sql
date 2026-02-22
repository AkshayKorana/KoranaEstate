-- AlterTable
ALTER TABLE "PriceObservation" ADD COLUMN "district" TEXT;
ALTER TABLE "PriceObservation" ADD COLUMN "originalUnit" TEXT;
ALTER TABLE "PriceObservation" ADD COLUMN "originalValue" REAL;
ALTER TABLE "PriceObservation" ADD COLUMN "reliability" REAL;
ALTER TABLE "PriceObservation" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "PriceObservation" ADD COLUMN "state" TEXT;
