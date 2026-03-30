CREATE TYPE "OrderSourceType" AS ENUM ('STORE', 'RAW_MARKETPLACE');

CREATE TYPE "OrderPaymentMethod" AS ENUM ('COD');

ALTER TABLE "RawProduct"
ADD COLUMN "location" TEXT;

ALTER TABLE "RetailProduct"
ADD COLUMN "imageUrl" TEXT;

ALTER TABLE "Order"
ADD COLUMN "sourceType" "OrderSourceType" NOT NULL DEFAULT 'STORE',
ADD COLUMN "paymentMethod" "OrderPaymentMethod" NOT NULL DEFAULT 'COD',
ADD COLUMN "customerName" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "addressLine1" TEXT,
ADD COLUMN "addressLine2" TEXT,
ADD COLUMN "area" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "pincode" TEXT,
ADD COLUMN "landmark" TEXT,
ADD COLUMN "orderNote" TEXT,
ADD COLUMN "itemNameSnapshot" TEXT,
ADD COLUMN "itemCategorySnapshot" TEXT,
ADD COLUMN "itemImageUrlSnapshot" TEXT,
ADD COLUMN "sellerNameSnapshot" TEXT,
ADD COLUMN "sellerIdSnapshot" TEXT,
ADD COLUMN "locationSnapshot" TEXT,
ADD COLUMN "unitLabelSnapshot" TEXT,
ADD COLUMN "quantitySnapshot" DECIMAL(12, 2),
ADD COLUMN "unitPriceSnapshot" DECIMAL(12, 2),
ADD COLUMN "rawProductId" TEXT;

CREATE INDEX "Order_sourceType_idx" ON "Order"("sourceType");

CREATE INDEX "Order_rawProductId_idx" ON "Order"("rawProductId");
