# Complete AI Dashboard Workflow - Start to End

## Production Readiness Quick Start

Set these environment variables before deployment:

```bash
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=replace-with-strong-secret
DATABASE_URL=<production-db-url>
STRICT_REAL_DATA=true
```

Notes:
- `STRICT_REAL_DATA=true` disables synthetic/fake market responses and returns `503` when live/cached real data is unavailable.
- `/api/health` returns deployment readiness for DB and auth env.

Quick checks after deploy:

```bash
curl -s https://your-domain.com/api/health
curl -s https://your-domain.com/api/market
curl -s "https://your-domain.com/api/indian-markets?district=Kodagu&state=Karnataka"
```

## 🎯 System Overview

**KoranaEstate AI Dashboard** is a real-time commodity price forecasting platform for Indian coffee and spice farmers. It aggregates data from multiple sources, applies ML forecasting, and displays bilingual (English/Kannada) predictions with transparency.

---

## 📊 Complete Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          🌐 EXTERNAL DATA SOURCES                    │
├─────────────────────────────────────────────────────────────────────┤
│  1. Yahoo Finance (ICE Futures: KC=F, RC=F)                         │
│  2. ExchangeRate-API.com (Live USD/INR Forex)                        │
│  3. Agmarknet.gov.in (Government Mandi Prices)                       │
│  4. Coffee Board India (Official Grade Prices)                       │
│  5. Spices Board India (Pepper, Cardamom, Arecanut)                  │
│  6. Regional Mandis (Karnataka, Kerala Wholesale Markets)            │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      🔄 DATA INGESTION LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│  API: /api/market (GET)                                              │
│    → Fetches Yahoo Finance futures (USD/lb)                          │
│    → Calls fetchLiveForexRate() → ExchangeRate-API                  │
│    → Converts to INR/kg using live forex                            │
│    → Writes to PriceObservation table (source: 'yahoo')             │
│                                                                       │
│  API: /api/indian-markets (GET with ?commodity=X)                   │
│    → fetchAgmarknetPrices() → Gov mandi data                        │
│    → fetchCommodityBoardPrices() → Board official rates             │
│    → fetchRegionalMandiPrices() → Local market spot prices          │
│    → aggregatePrices() → Weighted average (reliability × recency)   │
│    → Returns: { avgPrice, minPrice, maxPrice, sources: [...] }      │
│    → Does NOT persist (read-only aggregation)                       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      💾 DATABASE PERSISTENCE                         │
├─────────────────────────────────────────────────────────────────────┤
│  SQLite Database (Prisma ORM)                                        │
│                                                                       │
│  Tables:                                                             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ PriceObservation                                             │  │
│  │  - id, commodityName, priceInr, source, timestamp           │  │
│  │  - Stores: Yahoo futures, manual uploads, scraper results   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Commodity                                                    │  │
│  │  - id, name, variety, currentPrice, location, updatedAt     │  │
│  │  - Master catalog: 7 commodities (4 coffee grades + 3 spices)│ │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ForecastRun                                                  │  │
│  │  - id, commodityName, horizonDays, forecastDate, method     │  │
│  │  - predictedPrice, confidence, mape, mae, rmse, outputJson  │  │
│  │  - Stores: ML predictions with accuracy metrics             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ ModelLeaderboardSnapshot                                     │  │
│  │  - id, commodityName, modelName, horizonDays, mape          │  │
│  │  - Stores: Backtest accuracy (Linear vs Hybrid models)      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ AnalyticsEvent                                               │  │
│  │  - id, eventName, page, commodity, horizonDays, timestamp   │  │
│  │  - Tracks: User interactions for usage analytics            │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      🤖 ML FORECASTING ENGINE                        │
├─────────────────────────────────────────────────────────────────────┤
│  API: /api/forecast (GET with ?commodities=X&horizons=Y)           │
│                                                                       │
│  1. Query Historical Data                                            │
│     getCommodityHistoryValues() → PriceObservation records          │
│     → Collapses to daily median (handles multiple daily sources)    │
│                                                                       │
│  2. Hybrid Ensemble Forecasting (lib/forecast.ts)                   │
│     computeHybridForecast(history, horizonDays)                     │
│     ┌───────────────────────────────────────────────────────────┐  │
│     │ Model 1: Linear OLS Regression                            │  │
│     │   - Trend-based extrapolation                             │  │
│     │   - Returns: predicted price + MAE                        │  │
│     ├───────────────────────────────────────────────────────────┤  │
│     │ Model 2: Holt Exponential Smoothing                       │  │
│     │   - Level + Trend tracking (α=0.3, β=0.1)                │  │
│     │   - Returns: predicted price + MAE                        │  │
│     ├───────────────────────────────────────────────────────────┤  │
│     │ Model 3: Ridge Autoregressive AR(5)                       │  │
│     │   - Gradient descent with L2 regularization (λ=0.1)      │  │
│     │   - Returns: predicted price + MAE                        │  │
│     └───────────────────────────────────────────────────────────┘  │
│     ↓                                                                │
│     Weighted Ensemble: inverse-MAE weighting                        │
│       finalPrice = Σ(wi × pi) where wi = (1/MAEi) / Σ(1/MAEi)     │
│                                                                       │
│  3. Confidence Interval Calculation                                  │
│     - Compute residuals: actual - predicted (all 3 models)          │
│     - 80% CI: [p10(residuals), p90(residuals)]                      │
│     - Returns: lower/upper bounds around forecast                   │
│                                                                       │
│  4. Accuracy Metrics                                                 │
│     - MAPE: Mean Absolute Percentage Error                          │
│     - MAE: Mean Absolute Error (INR/kg)                             │
│     - RMSE: Root Mean Squared Error                                 │
│                                                                       │
│  5. Persist to Database                                              │
│     → ForecastRun table (commodityName, horizonDays, predictedPrice)│
│     → Includes: confidence bounds, metrics, full outputJson         │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    📈 MODEL EVALUATION & LEADERBOARD                 │
├─────────────────────────────────────────────────────────────────────┤
│  API: /api/model-leaderboard (GET)                                  │
│                                                                       │
│  evaluateRollingOos() - Out-of-Sample Backtesting                   │
│    1. Split history: 70% train / 30% test                           │
│    2. For each test point:                                           │
│       - Train on previous data only                                  │
│       - Predict next point                                           │
│       - Compare: predicted vs actual                                 │
│    3. Compute MAPE for Linear-v1 and Hybrid-v2                      │
│    4. Rank models by accuracy                                        │
│                                                                       │
│  Output: ModelLeaderboardSnapshot records                           │
│    - Which model performs best per commodity/horizon                │
│    - Used to show "Accuracy Track Record" in UI                     │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      🌐 API LAYER (User-Facing)                      │
├─────────────────────────────────────────────────────────────────────┤
│  Frontend calls these endpoints:                                     │
│                                                                       │
│  GET /api/commodities                                                │
│    → Aggregates PriceObservation by commodityName                   │
│    → Returns: currentPrice, historicalPrices[], hasRealData flag   │
│    → Used for: "Latest Prices" display                              │
│                                                                       │
│  GET /api/market                                                     │
│    → Returns Yahoo futures + live forex rate                        │
│    → Used for: "International Benchmark" comparison                 │
│                                                                       │
│  GET /api/indian-markets?commodity=X                                 │
│    → Returns multi-source mandi aggregation                         │
│    → Used for: "Indian Market Prices" min/max/avg display          │
│                                                                       │
│  GET /api/forecast?commodities=X,Y&horizons=3,7,14                  │
│    → Returns ML predictions for multiple horizons                   │
│    → Used for: "AI Forecast" chart with confidence bands           │
│                                                                       │
│  GET /api/model-leaderboard                                          │
│    → Returns accuracy rankings                                       │
│    → Used for: "Model Performance" transparency section             │
│                                                                       │
│  POST /api/analytics/event                                           │
│    → Logs user interactions (view_forecast, change_commodity, etc) │
│    → Used for: Usage analytics                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      🎨 FRONTEND DISPLAY (Next.js)                   │
├─────────────────────────────────────────────────────────────────────┤
│  File: app/page.tsx                                                  │
│                                                                       │
│  Component Structure:                                                │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Navbar (Language Toggle: English ⇄ Kannada)                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Hero Section                                                   │ │
│  │  - Title: "AI-Powered Commodity Price Forecasts"             │ │
│  │  - Subtitle: "Real-time Indian market data"                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Tabs: [Dashboard] [Marketplace]                               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  === DASHBOARD TAB ===                                               │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🔽 Commodity Selector Dropdown                                 │ │
│  │   Groups:                                                      │ │
│  │     • Arabica (Cherry, Parchment)                             │ │
│  │     • Robusta (Cherry, Parchment)                             │ │
│  │     • Spices (Cardamom, Arecanut, Pepper)                    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 📊 Current Market Prices                                       │ │
│  │   ┌─────────────────────────────────────────────────────────┐ │ │
│  │   │ Best Estimate: ₹X,XXX/kg                                │ │ │
│  │   │   Source: Latest observation from database              │ │ │
│  │   └─────────────────────────────────────────────────────────┘ │ │
│  │   ┌─────────────────────────────────────────────────────────┐ │ │
│  │   │ Multi-Source Indian Market Data                         │ │ │
│  │   │   • Average: ₹X,XXX/kg                                  │ │ │
│  │   │   • Range: ₹X,XXX - ₹X,XXX                              │ │ │
│  │   │   • Sources: Agmarknet, Coffee Board, Regional Mandis  │ │ │
│  │   └─────────────────────────────────────────────────────────┘ │ │
│  │   ┌─────────────────────────────────────────────────────────┐ │ │
│  │   │ ICE Futures (International): ₹X,XXX/kg                  │ │ │
│  │   │   USD/INR: ₹XX.XX (Live)                                │ │ │
│  │   └─────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 📈 Historical Price Chart (Chart.js)                          │ │
│  │   - Line graph: 30-day price trend                           │ │
│  │   - Y-axis: INR/kg                                            │ │
│  │   - X-axis: Dates                                             │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🔮 AI Forecast Section                                         │ │
│  │   [Horizon: 3 days] [7 days] [14 days]                       │ │
│  │   ┌─────────────────────────────────────────────────────────┐ │ │
│  │   │ Predicted Price: ₹X,XXX/kg                              │ │ │
│  │   │ Confidence: ₹X,XXX - ₹X,XXX (80% interval)              │ │ │
│  │   │ Model: Hybrid Ensemble (Linear + Holt + Ridge)          │ │ │
│  │   │ Accuracy: MAPE X.X%                                     │ │ │
│  │   └─────────────────────────────────────────────────────────┘ │ │
│  │   Chart: Historical + Forecast line with shaded CI band      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🏆 Model Leaderboard                                           │ │
│  │   Table: Model rankings by accuracy (out-of-sample MAPE)     │ │
│  │     | Model      | Horizon | MAPE  | Status      |           │ │
│  │     |------------|---------|-------|-------------|           │ │
│  │     | Hybrid-v2  | 3-day   | 2.3%  | ✅ Active   |           │ │
│  │     | Linear-v1  | 3-day   | 4.1%  | Baseline    |           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ ℹ️ Transparency Disclaimers                                    │ │
│  │   • Futures vs Spot: ICE prices are 3-6 month forward         │ │
│  │   • Wholesale vs Retail: +15-25% markup for consumers         │ │
│  │   • Grade Differences: Parchment ≠ Cherry ≠ Raw pricing       │ │
│  │   • Forex Impact: Live USD/INR rate shown                     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 📚 Data Sources Footer                                         │ │
│  │   Last Updated: Feb 20, 2026 10:30 AM IST                    │ │
│  │   Sources: Yahoo Finance, Agmarknet, Coffee Board India       │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  === MARKETPLACE TAB ===                                             │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 🛒 Buy/Sell Listings (Future Feature)                          │ │
│  │   - Farmers can list produce                                  │ │
│  │   - Buyers can make offers                                    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Footer (Bilingual Support)                                     │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    ⏰ AUTOMATED REFRESH PIPELINE                     │
├─────────────────────────────────────────────────────────────────────┤
│  POST /api/jobs/pipeline (Protected: Bearer CRON_SECRET)           │
│                                                                       │
│  Sequential Execution Every 6 Hours:                                │
│  1. runStep('/api/market')                                          │
│     → Refresh Yahoo futures + forex                                 │
│  2. runStep('/api/price-intel')                                     │
│     → Normalize multi-source data                                   │
│  3. runStep('/api/forecast?commodities=...&horizons=3,7,14')       │
│     → Generate new ML predictions                                   │
│  4. runStep('/api/model-leaderboard')                               │
│     → Update accuracy rankings                                      │
│                                                                       │
│  Triggers:                                                           │
│  • Vercel Cron: vercel.json → 0 */6 * * * (every 6 hours)         │
│  • GitHub Actions: .github/workflows/automated-pipeline.yml         │
│  • Manual: curl -X POST with Authorization header                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Step-by-Step Workflow

### Phase 1: System Initialization (First Deployment)

1. **Database Setup**
   ```bash
   # Run migrations
   npx prisma migrate deploy
   npx prisma generate
   ```

2. **Environment Configuration**
   ```env
   DATABASE_URL="file:./dev.db"
   CRON_SECRET="your-secure-random-secret"
   NEXTAUTH_SECRET="another-secure-secret"
   NEXTAUTH_URL="https://yourdomain.com"
   ```

3. **Seed Initial Commodities** (Optional)
   - Manually insert 7 commodities into `Commodity` table
   - Or let first API call auto-create via `upsert()`

### Phase 2: Data Acquisition (Every 6 Hours)

**Step 2.1: Fetch International Futures**
```typescript
// API: /api/market
1. Call Yahoo Finance: fetch('https://query1.finance.yahoo.com/v8/finance/chart/KC=F')
2. Extract latest close price (USD per pound)
3. Fetch live forex: fetchLiveForexRate() → ExchangeRate-API
4. Convert: USD/lb → INR/kg using live rate
5. Store in database:
   prisma.priceObservation.create({
     commodityName: 'Arabica Cherry', // Maps to ICE contract
     priceInr: converted_price,
     source: 'yahoo',
     timestamp: new Date()
   })
```

**Step 2.2: Aggregate Indian Mandi Data**
```typescript
// API: /api/indian-markets?commodity=Arabica%20Parchment
1. fetchAgmarknetPrices('Arabica Parchment')
   → Scrapes government mandi prices
   → Returns: [{ market, priceInr, date, reliability: 0.9 }]

2. fetchCommodityBoardPrices('Arabica Parchment')
   → Queries Coffee Board India official rates
   → Returns: [{ priceInr, date, reliability: 1.0 }]

3. fetchRegionalMandiPrices('Arabica Parchment')
   → Checks Karnataka/Kerala local markets
   → Returns: [{ market, priceInr, date, reliability: 0.7 }]

4. aggregatePrices(allSources)
   → Weighted average: weight = reliability × recency
   → Returns: {
       avgPrice: 450,
       minPrice: 430,
       maxPrice: 470,
       sources: ['Agmarknet Chikmagalur', 'Coffee Board Bangalore', ...]
     }
```

**Step 2.3: Store Processed Data**
```typescript
// Only Yahoo data persists automatically
// Indian mandi data aggregates on-demand (not stored)
// This prevents stale cached data
```

### Phase 3: ML Forecasting

**Step 3.1: Query Historical Data**
```typescript
// API: /api/forecast?commodities=Arabica Parchment&horizons=3,7,14
async function getCommodityHistoryValues(commodityName: string) {
  const observations = await prisma.priceObservation.findMany({
    where: { commodityName },
    orderBy: { timestamp: 'asc' }
  })
  
  // Collapse to daily median (handles multiple sources per day)
  const dailyPrices = groupByDate(observations).map(day => ({
    date: day.date,
    price: median(day.prices)
  }))
  
  return dailyPrices
}
```

**Step 3.2: Run Hybrid Ensemble**
```typescript
// lib/forecast.ts
function computeHybridForecast(history: number[], horizonDays: number) {
  // Model 1: Linear Regression
  const { prediction: p1, mae: mae1 } = fitLinear(history, horizonDays)
  
  // Model 2: Holt Smoothing
  const { prediction: p2, mae: mae2 } = predictHolt(history, horizonDays)
  
  // Model 3: Ridge AR(5)
  const { prediction: p3, mae: mae3 } = trainRidgeGD(history, horizonDays)
  
  // Inverse-MAE weighting
  const w1 = (1 / mae1) / ((1 / mae1) + (1 / mae2) + (1 / mae3))
  const w2 = (1 / mae2) / ((1 / mae1) + (1 / mae2) + (1 / mae3))
  const w3 = (1 / mae3) / ((1 / mae1) + (1 / mae2) + (1 / mae3))
  
  const finalPrediction = w1 * p1 + w2 * p2 + w3 * p3
  
  // 80% Confidence Interval
  const residuals = history.map((actual, i) => actual - predict(i))
  const lowerBound = finalPrediction + percentile(residuals, 0.10)
  const upperBound = finalPrediction + percentile(residuals, 0.90)
  
  return {
    predictedPrice: finalPrediction,
    confidenceLower: lowerBound,
    confidenceUpper: upperBound,
    mape: calculateMAPE(history, predictions),
    mae: calculateMAE(history, predictions),
    rmse: calculateRMSE(history, predictions)
  }
}
```

**Step 3.3: Persist Forecast Results**
```typescript
await prisma.forecastRun.create({
  data: {
    commodityName: 'Arabica Parchment',
    horizonDays: 7,
    forecastDate: new Date(),
    predictedPrice: 455.32,
    confidenceLower: 440.10,
    confidenceUpper: 470.54,
    method: 'hybrid-v2',
    mape: 2.34,
    mae: 10.5,
    rmse: 12.8,
    outputJson: JSON.stringify({ weights: [w1, w2, w3], ... })
  }
})
```

### Phase 4: Model Evaluation

**Step 4.1: Out-of-Sample Backtesting**
```typescript
// API: /api/model-leaderboard
function evaluateRollingOos(history: number[], horizonDays: number) {
  const trainSize = Math.floor(history.length * 0.7)
  const errors: number[] = []
  
  for (let i = trainSize; i < history.length - horizonDays; i++) {
    const trainData = history.slice(0, i)
    const actual = history[i + horizonDays]
    
    // Test Linear-v1
    const linearPred = fitLinear(trainData, horizonDays).prediction
    errors.push(Math.abs((actual - linearPred) / actual) * 100)
    
    // Test Hybrid-v2
    const hybridPred = computeHybridForecast(trainData, horizonDays).predictedPrice
    errors.push(Math.abs((actual - hybridPred) / actual) * 100)
  }
  
  const linearMAPE = mean(errors.filter((_, i) => i % 2 === 0))
  const hybridMAPE = mean(errors.filter((_, i) => i % 2 === 1))
  
  return { linearMAPE, hybridMAPE }
}
```

**Step 4.2: Store Leaderboard Rankings**
```typescript
await prisma.modelLeaderboardSnapshot.createMany({
  data: [
    {
      commodityName: 'Arabica Parchment',
      modelName: 'hybrid-v2',
      horizonDays: 7,
      mape: 2.34,
      trainedAt: new Date()
    },
    {
      commodityName: 'Arabica Parchment',
      modelName: 'linear-v1',
      horizonDays: 7,
      mape: 4.12,
      trainedAt: new Date()
    }
  ]
})
```

### Phase 5: API Responses to Frontend

**API Call 1: Get Latest Prices**
```typescript
// Frontend: fetch('/api/commodities')
// Backend returns:
{
  data: [
    {
      name: 'Arabica Parchment',
      currentPrice: 450,
      historicalPrices: [
        { date: '2026-02-19', price: 448 },
        { date: '2026-02-20', price: 450 }
      ],
      hasRealData: true
    }
  ],
  insights: {
    'Arabica Parchment': 'Last updated 2 hours ago from Yahoo Finance'
  }
}
```

**API Call 2: Get Multi-Source Indian Prices**
```typescript
// Frontend: fetch('/api/indian-markets?commodity=Arabica Parchment')
// Backend returns:
{
  avgPrice: 455,
  minPrice: 440,
  maxPrice: 470,
  sources: [
    { name: 'Agmarknet Chikmagalur', priceInr: 450, date: '2026-02-20' },
    { name: 'Coffee Board Karnataka', priceInr: 460, date: '2026-02-20' },
    { name: 'Hassan Mandi', priceInr: 445, date: '2026-02-19' }
  ],
  commodity: 'Arabica Parchment'
}
```

**API Call 3: Get Forecast**
```typescript
// Frontend: fetch('/api/forecast?commodities=Arabica Parchment&horizons=7')
// Backend returns:
{
  forecasts: [
    {
      commodityName: 'Arabica Parchment',
      horizonDays: 7,
      predictedPrice: 455.32,
      confidenceLower: 440.10,
      confidenceUpper: 470.54,
      method: 'hybrid-v2',
      mape: 2.34
    }
  ]
}
```

### Phase 6: UI Rendering

**Step 6.1: Load Data on Page Mount**
```typescript
// app/page.tsx
useEffect(() => {
  // Parallel fetches
  Promise.all([
    fetch('/api/commodities'),
    fetch('/api/market'),
    fetch('/api/forecast?commodities=Arabica Parchment,...&horizons=3,7,14'),
    fetch('/api/model-leaderboard')
  ]).then(([commodities, market, forecasts, leaderboard]) => {
    setCommodities(commodities.data)
    setMarketData(market)
    setForecasts(forecasts.forecasts)
    setLeaderboard(leaderboard.rankings)
  })
}, [])
```

**Step 6.2: Render Price Comparison**
```tsx
<div className="grid grid-cols-3 gap-4">
  <div>
    <h3>Best Estimate</h3>
    <p className="text-2xl">₹{currentPrice}/kg</p>
    <span className="text-sm">Source: Latest observation</span>
  </div>
  
  <div>
    <h3>Indian Mandi Average</h3>
    <p className="text-2xl">₹{indianMarkets.avgPrice}/kg</p>
    <span className="text-sm">Range: ₹{minPrice} - ₹{maxPrice}</span>
  </div>
  
  <div>
    <h3>ICE Futures</h3>
    <p className="text-2xl">₹{marketData.priceInr}/kg</p>
    <span className="text-sm">USD/INR: ₹{liveForexRate}</span>
  </div>
</div>
```

**Step 6.3: Render Forecast Chart**
```tsx
<Line
  data={{
    labels: [...historicalDates, ...forecastDates],
    datasets: [
      {
        label: 'Historical',
        data: historicalPrices,
        borderColor: 'blue'
      },
      {
        label: 'Forecast',
        data: [...Array(history.length).fill(null), forecastPrice],
        borderColor: 'green',
        borderDash: [5, 5]
      },
      {
        label: '80% Confidence',
        data: [...Array(history.length).fill(null), confidenceLower, confidenceUpper],
        backgroundColor: 'rgba(0,255,0,0.1)',
        fill: true
      }
    ]
  }}
/>
```

**Step 6.4: Render Language Toggle**
```tsx
const translations = {
  en: {
    forecast: 'AI Forecast',
    price: 'Price',
    horizon: 'Forecast Horizon'
  },
  kn: {
    forecast: 'AI ಮುನ್ಸೂಚನೆ',
    price: 'ಬೆಲೆ',
    horizon: 'ಮುನ್ಸೂಚನೆ ಅವಧಿ'
  }
}

<button onClick={() => setUiLang(uiLang === 'en' ? 'kn' : 'en')}>
  {uiLang === 'en' ? '🇮🇳 ಕನ್ನಡ' : '🇬🇧 English'}
</button>
```

### Phase 7: User Interaction & Analytics

**Step 7.1: Track User Actions**
```typescript
function trackEvent(eventName: string, extra?: any) {
  fetch('/api/analytics/event', {
    method: 'POST',
    body: JSON.stringify({
      eventName,
      page: activeTab,
      commodity: selectedCommodityName,
      horizonDays: selectedHorizon,
      lang: uiLang,
      meta: extra
    })
  })
}

// Examples:
trackEvent('view_forecast', { horizonDays: 7 })
trackEvent('change_commodity', { commodity: 'Arabica Cherry' })
trackEvent('toggle_language', { newLang: 'kn' })
```

**Step 7.2: Store Analytics**
```typescript
// API: /api/analytics/event (POST)
await prisma.analyticsEvent.create({
  data: {
    eventName: 'view_forecast',
    page: 'dashboard',
    commodity: 'Arabica Parchment',
    horizonDays: 7,
    lang: 'en',
    meta: { device: 'mobile' },
    timestamp: new Date()
  }
})
```

---

## 🔄 Automated Pipeline (Production)

### Vercel Cron (Recommended)

**File: vercel.json**
```json
{
  "crons": [
    {
      "path": "/api/jobs/pipeline",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Every 6 hours, executes:**
1. `/api/market` → Refresh Yahoo + Forex
2. `/api/price-intel` → Normalize data
3. `/api/forecast` → Generate predictions (7 commodities × 3 horizons = 21 forecasts)
4. `/api/model-leaderboard` → Update accuracy rankings

### Manual Trigger (Testing)

```bash
curl -X POST "https://yourdomain.com/api/jobs/pipeline" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### GitHub Actions (Alternative)

**File: .github/workflows/automated-pipeline.yml**
```yaml
name: Automated Pipeline
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  run-pipeline:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Pipeline
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/jobs/pipeline" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

## 📋 Environment Variables Checklist

```env
# Database
DATABASE_URL="file:./dev.db"

# Auth
NEXTAUTH_SECRET="random-secret-for-jwt"
NEXTAUTH_URL="https://yourdomain.com"

# Automation
CRON_SECRET="secure-random-secret-for-pipeline"

# Optional: Override forex (use live API by default)
# USD_TO_INR=83
```

---

## 🎯 Data Quality Guarantees

### Zero Synthetic Fallbacks
- ❌ No fake data generation
- ✅ Returns empty arrays when no observations available
- ✅ `hasRealData: false` flag indicates missing data
- ✅ UI shows "No data available" instead of mock values

### Multi-Source Validation
- **Yahoo Finance**: International futures benchmark
- **ExchangeRate-API**: Live forex (updates every 24h)
- **Agmarknet**: Government mandi prices (daily updates)
- **Commodity Boards**: Official rates (weekly updates)
- **Regional Mandis**: Local spot prices (real-time when available)

### Weighted Aggregation Formula
```
weight = reliability_score × recency_factor
reliability: 1.0 (Official Board) > 0.9 (Agmarknet) > 0.7 (Regional)
recency: 1.0 (today) → 0.5 (1 week old)

avgPrice = Σ(price × weight) / Σ(weight)
```

---

## 🧪 Testing the Complete Flow

### 1. Local Development Setup
```bash
npm install
npx prisma migrate dev
npm run dev
```

### 2. Seed Data Manually
```typescript
// Use Prisma Studio
npx prisma studio

// Or insert via API
curl -X GET http://localhost:3000/api/market
```

### 3. Verify Each API
```bash
# Test commodity prices
curl http://localhost:3000/api/commodities

# Test Indian markets
curl http://localhost:3000/api/indian-markets?commodity=Arabica%20Parchment

# Test forecast
curl "http://localhost:3000/api/forecast?commodities=Arabica%20Parchment&horizons=3,7,14"

# Test leaderboard
curl http://localhost:3000/api/model-leaderboard
```

### 4. Check Database
```sql
-- View price observations
SELECT * FROM PriceObservation ORDER BY timestamp DESC LIMIT 10;

-- View forecasts
SELECT * FROM ForecastRun ORDER BY forecastDate DESC LIMIT 10;

-- View accuracy rankings
SELECT * FROM ModelLeaderboardSnapshot ORDER BY mape ASC;
```

### 5. Test Pipeline
```bash
export CRON_SECRET="your-secret"
curl -X POST http://localhost:3000/api/jobs/pipeline \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### 6. Monitor Logs
```bash
# Vercel deployment logs
vercel logs

# Local development
# Check terminal output for API calls
```

---

## 📚 Deep Dive Documentation

For detailed algorithm explanations, see:
- **[ALGORITHM_DOCUMENTATION.md](ALGORITHM_DOCUMENTATION.md)** - ML forecasting methodology
- **[prisma/schema.prisma](prisma/schema.prisma)** - Database schema
- **[lib/forecast.ts](lib/forecast.ts)** - Core forecasting functions
- **[lib/india-market.ts](lib/india-market.ts)** - Conversion utilities

---

## 🚨 Common Issues & Solutions

### Issue: "No prices showing in UI"
**Solution:** Check database has observations
```bash
npx prisma studio
# Verify PriceObservation table has recent records
# If empty, manually trigger: curl /api/market
```

### Issue: "Forex rate stuck at 83"
**Solution:** Verify live API is working
```bash
# Check exchangerate-api.com is accessible
curl https://api.exchangerate-api.com/v4/latest/USD
# Should return JSON with INR rate
```

### Issue: "Forecasts show NaN"
**Solution:** Ensure sufficient historical data (minimum 14 days)
```sql
SELECT commodityName, COUNT(*) as observations
FROM PriceObservation
GROUP BY commodityName;
-- Each commodity should have 14+ records
```

### Issue: "Indian mandi prices missing"
**Solution:** API aggregation returns empty if no sources available
- Check Agmarknet.gov.in is online
- Verify commodity name aliases in COMMODITY_CONFIG
- Indian markets are read-only (not persisted), so no stale data

---

## 🎓 Learning Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://prisma.io/docs
- **Chart.js**: https://chartjs.org/docs
- **Time Series Forecasting**: https://otexts.com/fpp3/
- **Agmarknet API**: https://agmarknet.gov.in/

---

**Last Updated**: February 20, 2026
**Maintained By**: KoranaEstate Development Team
