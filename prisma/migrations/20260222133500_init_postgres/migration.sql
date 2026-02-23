-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Coffee" (
    "id" TEXT NOT NULL,
    "coffeeType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerKg" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coffee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commodity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variety" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "location" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commodity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceObservation" (
    "id" TEXT NOT NULL,
    "commodityName" TEXT NOT NULL,
    "grade" TEXT,
    "priceType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "marketCenter" TEXT,
    "state" TEXT,
    "district" TEXT,
    "unit" TEXT NOT NULL,
    "inrPerKg" DOUBLE PRECISION NOT NULL,
    "originalValue" DOUBLE PRECISION,
    "originalUnit" TEXT,
    "sourceUrl" TEXT,
    "reliability" DOUBLE PRECISION,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastRun" (
    "id" TEXT NOT NULL,
    "commodityName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "mape" DOUBLE PRECISION,
    "mae" DOUBLE PRECISION,
    "rmse" DOUBLE PRECISION,
    "trendText" TEXT NOT NULL,
    "pctMove" DOUBLE PRECISION,
    "lowerPct" DOUBLE PRECISION,
    "upperPct" DOUBLE PRECISION,
    "labelsJson" TEXT NOT NULL,
    "actualJson" TEXT NOT NULL,
    "forecastJson" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelLeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "commodityName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "mape" DOUBLE PRECISION,
    "mae" DOUBLE PRECISION,
    "rmse" DOUBLE PRECISION,
    "sampleCount" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelLeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "page" TEXT,
    "commodity" TEXT,
    "horizonDays" INTEGER,
    "lang" TEXT,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "grade" TEXT,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "pricePerKg" DOUBLE PRECISION NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "offerPrice" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstateListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "listingType" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstateListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "shippingAddress" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Commodity_name_variety_idx" ON "Commodity"("name", "variety");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE INDEX "PriceObservation_commodityName_priceType_observedAt_idx" ON "PriceObservation"("commodityName", "priceType", "observedAt");

-- CreateIndex
CREATE INDEX "PriceObservation_source_observedAt_idx" ON "PriceObservation"("source", "observedAt");

-- CreateIndex
CREATE INDEX "ForecastRun_commodityName_generatedAt_idx" ON "ForecastRun"("commodityName", "generatedAt");

-- CreateIndex
CREATE INDEX "ForecastRun_modelVersion_generatedAt_idx" ON "ForecastRun"("modelVersion", "generatedAt");

-- CreateIndex
CREATE INDEX "ModelLeaderboardSnapshot_commodityName_horizonDays_generate_idx" ON "ModelLeaderboardSnapshot"("commodityName", "horizonDays", "generatedAt");

-- CreateIndex
CREATE INDEX "ModelLeaderboardSnapshot_modelVersion_horizonDays_generated_idx" ON "ModelLeaderboardSnapshot"("modelVersion", "horizonDays", "generatedAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventName_createdAt_idx" ON "AnalyticsEvent"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_commodity_createdAt_idx" ON "AnalyticsEvent"("commodity", "createdAt");

-- CreateIndex
CREATE INDEX "RawListing_commodity_isActive_createdAt_idx" ON "RawListing"("commodity", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "RawListing_sellerId_isActive_idx" ON "RawListing"("sellerId", "isActive");

-- CreateIndex
CREATE INDEX "RawListing_location_commodity_idx" ON "RawListing"("location", "commodity");

-- CreateIndex
CREATE INDEX "RawOffer_listingId_status_idx" ON "RawOffer"("listingId", "status");

-- CreateIndex
CREATE INDEX "RawOffer_buyerId_status_idx" ON "RawOffer"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Product_category_isActive_createdAt_idx" ON "Product"("category", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Product_sellerId_isActive_idx" ON "Product"("sellerId", "isActive");

-- CreateIndex
CREATE INDEX "EstateListing_category_listingType_isActive_createdAt_idx" ON "EstateListing"("category", "listingType", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "EstateListing_sellerId_isActive_idx" ON "EstateListing"("sellerId", "isActive");

-- CreateIndex
CREATE INDEX "EstateListing_location_category_idx" ON "EstateListing"("location", "category");

-- CreateIndex
CREATE INDEX "Order_buyerId_status_createdAt_idx" ON "Order"("buyerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_productId_createdAt_idx" ON "Order"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_buyerId_lastMessageAt_idx" ON "Conversation"("buyerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_sellerId_lastMessageAt_idx" ON "Conversation"("sellerId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_buyerId_sellerId_key" ON "Conversation"("buyerId", "sellerId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- AddForeignKey
ALTER TABLE "RawListing" ADD CONSTRAINT "RawListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawOffer" ADD CONSTRAINT "RawOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "RawListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawOffer" ADD CONSTRAINT "RawOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstateListing" ADD CONSTRAINT "EstateListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

