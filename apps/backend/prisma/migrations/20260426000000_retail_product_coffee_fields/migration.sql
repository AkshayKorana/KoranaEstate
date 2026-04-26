-- Add coffee variant and chicory percentage fields to RetailProduct
ALTER TABLE "RetailProduct" ADD COLUMN "coffeeVariant" TEXT;
ALTER TABLE "RetailProduct" ADD COLUMN "coffeeVariantPct" DECIMAL(5,2);
ALTER TABLE "RetailProduct" ADD COLUMN "chicoryPct" DECIMAL(5,2);
