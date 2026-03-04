'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import Hero from './components/Hero'
import Footer from './components/Footer'
import { getStandardBagWeightKg, toInrPerBag, toInrPerQuintal } from '@/lib/india-market'
import { useLanguage } from './language-context'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)
const Line = dynamic(() => import('react-chartjs-2').then(mod => mod.Line), { ssr: false })

type HistoricalPoint = { date: string; price?: number; inrPerKg?: number }

interface Commodity {
  name: string
  variety?: string
  price?: number
  currentPrice?: number
  location?: string
  source?: string
  historicalPrices?: HistoricalPoint[]
}

interface APIResponse {
  data: Commodity[]
  insights: Record<string, string>
}

interface MarketplaceItem {
  id: string
  name: string
  type: string
  kind: 'raw' | 'product'
  price: number
  quantity: number
  location?: string
}

interface RawListingsApiResponse {
  listings?: Array<{
    id: string
    commodity: string
    quantityKg: number
    pricePerKg: number
    location: string
  }>
}

interface ProductsApiResponse {
  products?: Array<{
    id: string
    name: string
    category: string
    price: number
    stock: number
  }>
}

interface MarketPoint {
  date: string
  inrPerKg: number
}

interface MarketQuote {
  usdPerLb: number | null
  inrPerKg: number | null
  history?: MarketPoint[]
  source?: string
}

interface MarketResponse {
  arabica: MarketQuote
  robusta: MarketQuote
  updatedAt: string
  updatedAtIst?: string
  source: string
  fx?: {
    usdToInr: number
    source: string
  }
}

interface IndianMarketSource {
  name: string
  status: 'success' | 'error'
  prices: Array<{ priceInrPerKg: number }>
  error?: string
}

interface IndianMarketItem {
  commodity: string
  currentPrice: number
  minPrice: number
  maxPrice: number
  avgPrice: number
  sampleCount: number
  sources: IndianMarketSource[]
}

interface IndianMarketsResponse {
  markets: IndianMarketItem[]
  updatedAt: string
  updatedAtIst?: string
  filtersApplied?: {
    district?: string
    state?: string
    commodity?: string | null
  }
}

interface ForecastCommodity {
  commodity: string
  modelVersion: string
  horizons: Array<{
    horizonDays: number
    labels: string[]
    actualSeries: Array<number | null>
    forecastSeries: Array<number | null>
    lowerSeries: Array<number | null>
    upperSeries: Array<number | null>
    trendText: string
    metrics: { mape: number | null; mae: number | null; rmse: number | null }
    range: { pctMove: number | null; lowerPct: number | null; upperPct: number | null }
    diagnostics: {
      linearMae: number | null
      holtMae: number | null
      ensembleWeightLinear: number
      ensembleWeightHolt: number
      regime: 'calm' | 'normal' | 'volatile'
      ridgeMae?: number | null
      ensembleWeightRidge?: number
    }
  }>
}

interface ForecastResponse {
  updatedAt: string
  updatedAtIst?: string
  modelVersion: string
  horizons: number[]
  commodities: ForecastCommodity[]
}

interface LeaderboardResponse {
  updatedAt: string
  updatedAtIst?: string
  leaderboard: Array<{
    commodity: string
    horizonDays: number
    ranking: Array<{
      modelVersion: string
      mape: number | null
      mae: number | null
      rmse: number | null
      sampleCount: number
    }>
  }>
}

const DASHBOARD_OPTIONS = [
  { group: 'Arabica', names: ['Arabica Cherry', 'Arabica Parchment'] },
  { group: 'Robusta', names: ['Robusta Cherry', 'Robusta Parchment'] },
  { group: 'Spices', names: ['Cardamom', 'Arecanut', 'Pepper'] },
] as const

type ActionSignal = 'SELL_NOW' | 'WAIT' | 'HOLD'

function CountUpPrice({ value }: { value: number | null }) {
  const [display, setDisplay] = useState(0)
  const targetValue = value != null && Number.isFinite(value) ? value : 0
  const previousValueRef = useRef(0)

  useEffect(() => {
    const duration = 650
    const start = performance.now()
    const from = previousValueRef.current
    let raf = 0

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = from + (targetValue - from) * eased
      setDisplay(next)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    previousValueRef.current = targetValue
    return () => cancelAnimationFrame(raf)
  }, [targetValue])

  if (value == null) return <span>-</span>

  return <span>₹{display.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/kg</span>
}

export default function HomePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'Marketplace' | 'Dashboard'>('Dashboard')
  const [selectedCommodityName, setSelectedCommodityName] = useState<string>('Arabica Cherry')
  const [selectedHorizon, setSelectedHorizon] = useState<number>(3)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { lang: uiLang } = useLanguage()

  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)

  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [insights, setInsights] = useState<Record<string, string>>({})
  const [market, setMarket] = useState<MarketResponse | null>(null)
  const [marketError, setMarketError] = useState<string | null>(null)
  const [indianMarkets, setIndianMarkets] = useState<IndianMarketsResponse | null>(null)
  const [indianMarketsError, setIndianMarketsError] = useState<string | null>(null)
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)

  function trackEvent(
    eventName: string,
    extra?: Partial<{ commodity: string; horizonDays: number; meta: Record<string, unknown> }>
  ) {
    const payload = {
      eventName,
      page: activeTab === 'Dashboard' ? 'dashboard' : 'marketplace',
      commodity: extra?.commodity ?? selectedCommodityName,
      horizonDays: extra?.horizonDays ?? selectedHorizon,
      lang: uiLang,
      meta: extra?.meta,
    }

    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  }

  useEffect(() => {
    async function fetchMarketplaceItems() {
      try {
        const [rawRes, productsRes] = await Promise.all([
          fetch('/api/raw/listings?limit=12', { cache: 'no-store' }),
          fetch('/api/products?limit=12', { cache: 'no-store' }),
        ])

        const rawJson: RawListingsApiResponse = rawRes.ok ? await rawRes.json() : {}
        const productsJson: ProductsApiResponse = productsRes.ok ? await productsRes.json() : {}

        const rawItems: MarketplaceItem[] = (rawJson.listings ?? []).map((row) => ({
          id: `raw-${row.id}`,
          name: row.commodity,
          type: 'Raw Listing',
          kind: 'raw',
          price: row.pricePerKg,
          quantity: row.quantityKg,
          location: row.location,
        }))

        const productItems: MarketplaceItem[] = (productsJson.products ?? []).map((row) => ({
          id: `product-${row.id}`,
          name: row.name,
          type: row.category,
          kind: 'product',
          price: row.price,
          quantity: row.stock,
          location: 'Store',
        }))

        setItems([...rawItems, ...productItems])
      } catch (error) {
        console.error('Failed to fetch marketplace items:', error)
        setItems([])
      } finally {
        setItemsLoading(false)
      }
    }

    fetchMarketplaceItems()
  }, [])

  useEffect(() => {
    async function fetchCommodities() {
      try {
        const res = await fetch('/api/commodities')
        const json: APIResponse = await res.json()
        setCommodities(json.data)
        setInsights(json.insights)

        const preferred = ['Arabica Cherry', 'Arabica Parchment', 'Robusta Cherry', 'Robusta Parchment', 'Cardamom', 'Arecanut', 'Pepper']
        const firstAvailable = preferred.find(name => json.data.some(c => c.name === name))
        if (firstAvailable) setSelectedCommodityName(firstAvailable)
      } catch (err) {
        console.error(err)
      }
    }

    fetchCommodities()
  }, [])

  useEffect(() => {
    async function fetchForecast() {
      try {
        const names = ['Arabica Cherry', 'Arabica Parchment', 'Robusta Cherry', 'Robusta Parchment', 'Cardamom', 'Arecanut', 'Pepper'].join(',')
        const res = await fetch(`/api/forecast?commodities=${encodeURIComponent(names)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed with status ${res.status}`)
        const json: ForecastResponse = await res.json()
        setForecastData(json)
        setForecastError(null)
      } catch (err) {
        console.error(err)
        setForecastError('Unable to load validated forecast right now.')
      }
    }

    fetchForecast()
  }, [])

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const names = ['Arabica Cherry', 'Arabica Parchment', 'Robusta Cherry', 'Robusta Parchment', 'Cardamom', 'Arecanut', 'Pepper'].join(',')
        const res = await fetch(`/api/model-leaderboard?commodities=${encodeURIComponent(names)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed with status ${res.status}`)
        const json: LeaderboardResponse = await res.json()
        setLeaderboard(json)
        setLeaderboardError(null)
      } catch (err) {
        console.error(err)
        setLeaderboardError('Unable to load model leaderboard right now.')
      }
    }
    if (showAdvanced && !leaderboard) fetchLeaderboard()
  }, [showAdvanced, leaderboard])

  useEffect(() => {
    async function fetchMarketPrices() {
      try {
        const res = await fetch('/api/market', { cache: 'no-store' })
        if (!res.ok) {
          const errorJson = await res.json().catch(() => ({}))
          const detail = typeof errorJson?.error === 'string' ? errorJson.error : `Failed with status ${res.status}`
          throw new Error(detail)
        }
        const json: MarketResponse = await res.json()
        setMarket(json)
        setMarketError(null)
      } catch (err) {
        console.error(err)
        const message = err instanceof Error ? err.message : 'Unable to load live benchmark prices right now.'
        setMarketError(message)
      }
    }

    async function fetchIndianMarkets() {
      try {
        const res = await fetch('/api/indian-markets?district=Kodagu&state=Karnataka', { cache: 'no-store' })
        if (!res.ok) {
          const errorJson = await res.json().catch(() => ({}))
          const detail = typeof errorJson?.error === 'string' ? errorJson.error : `Failed with status ${res.status}`
          throw new Error(detail)
        }
        const json: IndianMarketsResponse = await res.json()
        setIndianMarkets(json)
        setIndianMarketsError(null)
      } catch (err) {
        console.error(err)
        const message = err instanceof Error ? err.message : 'Unable to load Indian mandi prices right now.'
        setIndianMarketsError(message)
      }
    }

    fetchMarketPrices()
    fetchIndianMarkets()
  }, [])

  const selectedCommodity = commodities.find(c => c.name === selectedCommodityName) || null

  function benchmarkFor(name: string): MarketQuote | null {
    if (!market) return null
    if (name === 'Arabica') return market.arabica
    if (name === 'Robusta') return market.robusta
    return null
  }

  const selectedBenchmark = benchmarkFor(selectedCommodityName)

  const displayedPrice =
    selectedCommodity?.currentPrice ??
    selectedCommodity?.price ??
    selectedBenchmark?.inrPerKg ??
    null

  function formatInr(value: number | null) {
    if (value == null) return '-'
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}/kg`
  }

  function formatCurrency(value: number | null, suffix: string) {
    if (value == null) return '-'
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${suffix}`
  }

  const selectedForecast = forecastData?.commodities.find(c => c.commodity === selectedCommodityName)
  const selectedForecastHorizon = selectedForecast?.horizons.find(h => h.horizonDays === selectedHorizon) ?? selectedForecast?.horizons[0]
  const selectedLeaderboard = leaderboard?.leaderboard.find(
    row => row.commodity === selectedCommodityName && row.horizonDays === selectedHorizon
  )
  const bagKg = getStandardBagWeightKg(selectedCommodityName)
  const displayPerBag = toInrPerBag(displayedPrice, selectedCommodityName)
  const displayPerQuintal = toInrPerQuintal(displayedPrice)

  function confidenceLabel(mape: number | null) {
    if (mape == null) return 'Not enough data'
    if (mape <= 4) return 'High confidence'
    if (mape <= 8) return 'Medium confidence'
    return 'Use with caution'
  }

  function simpleDirection(pctMove: number | null) {
    if (pctMove == null) return 'stable'
    if (pctMove > 0.8) return 'up'
    if (pctMove < -0.8) return 'down'
    return 'stable'
  }

  function translate(en: string, kn: string) {
    return uiLang === 'kn' ? kn : en
  }

  function actionRecommendation(pctMove: number | null, mape: number | null) {
    if (pctMove == null || mape == null) {
      return {
        signal: 'HOLD' as ActionSignal,
        action: translate('HOLD', 'ನಿರೀಕ್ಷಿಸಿ'),
        note: translate('Insufficient historical data for ensemble forecast. Collecting observations...', 'ಡೇಟಾ ಇನ್ನೂ ಸೇರುತ್ತಿದೆ. ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಮತ್ತೆ ನೋಡಿ.'),
        detail: translate(
          'Algorithm requires minimum 8 days of price history to generate validated predictions.',
          'ಮಾನ್ಯ ಮುನ್ಸೂಚನೆಗೆ ಕನಿಷ್ಠ 8 ದಿನಗಳ ಇತಿಹಾಸ ಬೇಕು.'
        ),
      }
    }
    const accuracy = mape <= 4 ? translate('high accuracy', 'ಹೆಚ್ಚು ನಿಖರತೆ') : mape <= 8 ? translate('moderate accuracy', 'ಮಧ್ಯಮ ನಿಖರತೆ') : translate('lower accuracy', 'ಕಡಿಮೆ ನಿಖರತೆ')
    if (pctMove <= -2.0) {
      return {
        signal: 'SELL_NOW' as ActionSignal,
        action: translate('SELL NOW', 'ಈಗಲೇ ಮಾರಾಟ ಮಾಡಿ'),
        note: translate(
          `Ensemble model predicts ≥2% price decline with ${accuracy} (MAPE ${mape.toFixed(1)}%). Consider liquidating stock.`,
          `ಮಾದರಿ ${mape.toFixed(1)}% ದೋಷದೊಂದಿಗೆ 2%+ ಕುಸಿತ ಮುನ್ಸೂಚಿಸುತ್ತದೆ. ಮಾರಾಟ ಪರಿಗಣಿಸಿ.`
        ),
        detail: translate(
          'Algorithmic signal: market pressure detected. Ridge regression & Holt smoothing align on downtrend.',
          'ಮಾರುಕಟ್ಟೆ ಒತ್ತಡ ಪತ್ತೆಯಾಗಿದೆ. ಎಲ್ಲಾ ಮೂರು ಮಾದರಿಗಳು ಕುಸಿತವನ್ನು ಸೂಚಿಸುತ್ತವೆ.'
        ),
      }
    }
    if (pctMove >= 2.0) {
      return {
        signal: 'WAIT' as ActionSignal,
        action: translate('WAIT', 'ಕಾಯಿರಿ'),
        note: translate(
          `Ensemble model predicts ≥2% price gain with ${accuracy} (MAPE ${mape.toFixed(1)}%). Holding may increase returns.`,
          `ಮಾದರಿ ${mape.toFixed(1)}% ದೋಷದೊಂದಿಗೆ 2%+ ಏರಿಕೆ ಮುನ್ಸೂಚಿಸುತ್ತದೆ. ಕಾಯುವುದು ಲಾಭಕರ.`
        ),
        detail: translate(
          'Algorithmic signal: bullish momentum detected across linear, Holt, and ridge models.',
          'ಎಲ್ಲಾ ಮೂರು ಮಾದರಿಗಳು ಬೆಲೆ ಏರಿಕೆಯನ್ನು ಸೂಚಿಸುತ್ತವೆ.'
        ),
      }
    }
    return {
      signal: 'HOLD' as ActionSignal,
      action: translate('HOLD', 'ನಿರೀಕ್ಷಿಸಿ'),
      note: translate(
        `Ensemble forecasts ${Math.abs(pctMove).toFixed(1)}% move (within <2% threshold) with ${accuracy} (MAPE ${mape.toFixed(1)}%). Neutral window—sell if urgent.`,
        `ಮಾದರಿ ${Math.abs(pctMove).toFixed(1)}% ಚಲನೆ ಮುನ್ಸೂಚಿಸುತ್ತದೆ (${mape.toFixed(1)}% ದೋಷ). ತುರ್ತಿದ್ದರೆ ಮಾತ್ರ ಮಾರಾಟ.`
      ),
      detail: translate(
        'Algorithmic signal: low volatility detected. Models converge on stable pricing window.',
        'ಕಡಿಮೆ ಚಂಚಲತೆ. ಬೆಲೆ ಸ್ಥಿರವಾಗಿರುವ ಸಾಧ್ಯತೆ.'
      ),
    }
  }

  const recommendation = actionRecommendation(
    selectedForecastHorizon?.range.pctMove ?? null,
    selectedForecastHorizon?.metrics.mape ?? null
  )

  function bestTimeToSellText(signal: ActionSignal, pctMove: number | null) {
    if (signal === 'SELL_NOW') {
      return translate(
        `Optimal timing: Immediate sale recommended. Forecast predicts ${Math.abs(pctMove ?? 0).toFixed(1)}% decline—price peak likely passed.`,
        `ತಕ್ಷಣ ಮಾರಾಟ ಶಿಫಾರಸು. ${Math.abs(pctMove ?? 0).toFixed(1)}% ಕುಸಿತ ಮುನ್ಸೂಚನೆ—ಬೆಲೆ ಗರಿಷ್ಠ ದಾಟಿದೆ.`
      )
    }
    if (signal === 'WAIT') {
      return translate(
        `Optimal timing: Delay sale 2-4 days. Ensemble projects ${(pctMove ?? 0).toFixed(1)}% gain—price upswing in progress.`,
        `2-4 ದಿನ ಕಾಯಿರಿ. ${(pctMove ?? 0).toFixed(1)}% ಏರಿಕೆ ಮುನ್ಸೂಚನೆ—ಬೆಲೆ ಏರುತ್ತಿದೆ.`
      )
    }
    const move = pctMove == null ? '' : ` (${pctMove.toFixed(1)}%)`
    return translate(
      `Optimal timing: Flexible window this week${move}. Models show neutral drift—no urgency detected.`,
      `ಈ ವಾರ ಯಾವುದೇ ದಿನ ಸೂಕ್ತ${move}. ತಟಸ್ಥ ಚಲನೆ—ತುರ್ತು ಇಲ್ಲ.`
    )
  }

  return (
    <div id="top" className="space-y-14">
      <div>
        <Hero />
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-10 space-y-8">
        <div className="flex space-x-4 border-b border-emerald-200/25">
          <button
            className={`tab-luxe px-5 py-2 font-semibold rounded-t-xl transition-all ${activeTab === 'Dashboard' ? 'active bg-[#1f241d] text-[#f2e8d8] shadow-md border-t-2 border-emerald-500' : 'text-[#bcae9a] hover:text-[#efe4d4]'}`}
            onClick={() => {
              setActiveTab('Dashboard')
              trackEvent('tab_change', { meta: { tab: 'Dashboard' } })
            }}
          >
            {translate('AI / Commodity Dashboard', 'AI / ವಸ್ತು ಡ್ಯಾಶ್‌ಬೋರ್ಡ್')}
          </button>
          <button
            className={`tab-luxe px-5 py-2 font-semibold rounded-t-xl transition-all ${activeTab === 'Marketplace' ? 'active bg-[#1f241d] text-[#f2e8d8] shadow-md border-t-2 border-emerald-500' : 'text-[#bcae9a] hover:text-[#efe4d4]'}`}
            onClick={() => {
              setActiveTab('Marketplace')
              trackEvent('tab_change', { meta: { tab: 'Marketplace' } })
            }}
          >
            {translate('Marketplace', 'ಮಾರುಕಟ್ಟೆ')}
          </button>
        </div>

        {activeTab === 'Marketplace' && (
          <div className="space-y-4 section-reveal">
            {itemsLoading && (
              <div className="lux-stat rounded-xl px-4 py-3 text-sm text-[#d8e8dc]">
                {translate('Loading live listings...', 'ಲೈವ್ ಲಿಸ್ಟಿಂಗ್‌ಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...')}
              </div>
            )}

            {!itemsLoading && items.length === 0 && (
              <div className="rounded-xl border border-amber-300/35 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                {translate('No live listings found. Add items in Raw Marketplace or Store to see them here.', 'ಲೈವ್ ಲಿಸ್ಟಿಂಗ್‌ಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ಇಲ್ಲಿ ಕಾಣಲು ರಾ ಮಾರುಕಟ್ಟೆ ಅಥವಾ ಸ್ಟೋರ್‌ನಲ್ಲಿ ಐಟಂಗಳನ್ನು ಸೇರಿಸಿ.')}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => (
              <div key={item.id} className="glass card-hover soft-glow-hover p-6 rounded-3xl shadow-lg border border-emerald-200/25">
                <h3 className="font-luxe text-2xl font-bold text-[#f3e4d0] mb-1">{item.name}</h3>
                <span className="inline-block mb-2 px-3 py-1 text-xs font-medium gradient-brand-spectrum text-white rounded-full">{item.type}</span>
                <p className="text-[#f1e6d7] font-semibold">
                  {translate('Price', 'ಬೆಲೆ')}: ₹{item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  {item.kind === 'raw' ? '/kg' : ''}
                </p>
                <p className="text-[#d9c8b5]">{item.kind === 'raw' ? translate('Qty (kg)', 'ಪ್ರಮಾಣ (ಕೆಜಿ)') : translate('Stock', 'ಸ್ಟಾಕ್')}: {item.quantity}</p>
                <p className="text-[#bca995]">{translate('Location', 'ಸ್ಥಳ')}: {item.location || translate('India', 'ಭಾರತ')}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    className="flex-1 py-2 rounded-xl lux-btn-primary font-semibold shadow"
                    onClick={() => {
                      trackEvent('marketplace_view_click', {
                        commodity: item.name,
                        meta: { itemId: item.id, price: item.price, kind: item.kind },
                      })
                      router.push(item.kind === 'raw' ? '/raw-marketplace' : '/store')
                    }}
                  >
                    {translate('View', 'ವೀಕ್ಷಿಸಿ')}
                  </button>
                  <button
                    className="flex-1 py-2 rounded-xl lux-btn-secondary font-semibold shadow"
                    onClick={() => {
                      trackEvent('marketplace_view_market_click', {
                        commodity: item.name,
                        meta: { itemId: item.id, price: item.price, kind: item.kind },
                      })
                      router.push(item.kind === 'raw' ? '/raw-marketplace' : '/store')
                    }}
                  >
                    {translate('View Market', 'ಮಾರುಕಟ್ಟೆ ವೀಕ್ಷಿಸಿ')}
                  </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {activeTab === 'Dashboard' && (
          <section className="luxe-surface p-6 rounded-3xl shadow-lg space-y-6 section-reveal">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-luxe text-3xl font-bold text-[#f6e8d7]">{translate('Commodity Price Assistant', 'ಬೆಳೆ ಬೆಲೆ ಸಹಾಯಕ')}</h2>
            </div>
            <p className="text-sm text-[#d5c4b2]">
              {translate(
                "ML-powered price analysis: Real market data from Indian mandis (Agmarknet, Commodity Boards), ICE Futures (live forex conversion), zero synthetic fallbacks. Ensemble forecast with 80% confidence bands.",
                'ಯಂತ್ರ ಕಲಿಕೆ ಮೂಲಕ ಬೆಲೆ ವಿಶ್ಲೇಷಣೆ: ಭಾರತೀಯ ಮಾಂಡಿಗಳಿಂದ ನೈಜ ಮಾರುಕಟ್ಟೆ ಡೇಟಾ (ಅಗ್‌ಮಾರ್ಕ್‌ನೆಟ್, ಕಮೋಡಿಟಿ ಬೋರ್ಡ್‌ಗಳು), ICE ಫ್ಯೂಚರ್ಸ್ (ಲೈವ್ ಫಾರೆಕ್ಸ್), ಶೂನ್ಯ ಸಿಂಥೆಟಿಕ್ ಫಾಲ್‌ಬ್ಯಾಕ್‌ಗಳು.'
              )}
            </p>

            <div className="cinematic-divider" />

            <div className="max-w-sm">
              <label htmlFor="commodity-select" className="block text-sm font-medium text-[#d7cab8] mb-2">
                {translate('Choose Crop', 'ಬೆಳೆ ಆಯ್ಕೆಮಾಡಿ')}
              </label>
              <select
                id="commodity-select"
                className="lux-input w-full p-3 rounded-xl font-medium"
                value={selectedCommodityName}
                onChange={e => {
                  const nextCommodity = e.target.value
                  setSelectedCommodityName(nextCommodity)
                  trackEvent('commodity_change', { commodity: nextCommodity })
                }}
              >
                {DASHBOARD_OPTIONS.map(group => (
                  <optgroup key={group.group} label={group.group}>
                    {group.names.map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#d7cab8]">Prediction Window:</span>
              {[3, 7].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setSelectedHorizon(h)
                    trackEvent('horizon_change', { horizonDays: h })
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${selectedHorizon === h ? 'lux-btn-primary' : 'lux-btn-secondary'}`}
                >
                  {translate(`${h} Days`, `${h} ದಿನ`)}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-[#171411]/80 border border-emerald-200/25 p-5 shadow-lg space-y-3">
              <h3 className="font-bold text-xl text-[#efe4d4]">{selectedCommodityName}</h3>
              
              {/* Multi-Source Price Display */}
              <div className="rounded-2xl border border-[#9bb4cc] bg-gradient-to-br from-[#f6f4ef] to-[#e8f0f6] p-4 space-y-2 dark:from-slate-900 dark:to-slate-800 dark:border-slate-600">
                <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-2">
                  {translate('📊 Multi-Source Price Comparison', '📊 ಬಹು-ಮೂಲ ಬೆಲೆ ಹೋಲಿಕೆ')}
                </p>
                
                {/* Primary Display Price */}
                <div className="bg-white/90 dark:bg-slate-900 rounded-xl p-3 border border-blue-300 dark:border-slate-600">
                  <p className="text-sm text-gray-600 dark:text-gray-300">{translate('Best Estimate (Weighted)', 'ಅತ್ಯುತ್ತಮ ಅಂದಾಜು (ತೂಕ)')}</p>
                  <p className="metric-number text-4xl font-extrabold text-[#1f170f] dark:text-[#f2e5d5]">
                    <CountUpPrice value={displayedPrice} />
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{selectedCommodity?.source || 'Aggregated data'}</p>
                </div>

                {/* Indian Market Prices */}
                {indianMarkets && indianMarkets.markets && (() => {
                  const marketData = indianMarkets.markets.find((m) => m.commodity === selectedCommodityName)
                  if (marketData && marketData.sampleCount > 0) {
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="bg-white rounded p-2 border border-green-200">
                          <p className="text-xs text-gray-600">🇮🇳 Indian Mandi Avg</p>
                          <p className="text-lg font-semibold text-green-700">{formatInr(marketData.currentPrice)}</p>
                          <p className="text-xs text-gray-500">{marketData.sampleCount} sources</p>
                          </div>
                          <div className="bg-white rounded p-2 border border-amber-200">
                          <p className="text-xs text-gray-600">📉 Min</p>
                          <p className="text-lg font-semibold text-amber-700">{formatInr(marketData.minPrice)}</p>
                          </div>
                          <div className="bg-white rounded p-2 border border-red-200">
                          <p className="text-xs text-gray-600">📈 Max</p>
                          <p className="text-lg font-semibold text-red-700">{formatInr(marketData.maxPrice)}</p>
                          </div>
                        </div>

                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <p className="text-xs font-semibold text-blue-900 mb-2">Source-wise Feed ({indianMarkets.filtersApplied?.district || 'Kodagu'})</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {marketData.sources.map((source) => {
                              const prices = source.prices.map((p) => p.priceInrPerKg)
                              const hasData = source.status === 'success' && prices.length > 0
                              const avg = hasData
                                ? prices.reduce((sum, val) => sum + val, 0) / prices.length
                                : null
                              const min = hasData ? Math.min(...prices) : null
                              const max = hasData ? Math.max(...prices) : null

                              return (
                                <div key={source.name} className="rounded bg-white border border-blue-100 p-2">
                                  <p className="text-xs font-semibold text-gray-800">{source.name}</p>
                                  {hasData ? (
                                    <>
                                      <p className="text-sm text-emerald-700 font-semibold">Avg: {formatInr(avg)}</p>
                                      <p className="text-xs text-gray-600">Range: {formatInr(min)} - {formatInr(max)}</p>
                                      <p className="text-xs text-gray-500">Samples: {prices.length}</p>
                                    </>
                                  ) : (
                                    <p className="text-xs text-gray-500 italic">No fresh observations</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return <p className="text-xs text-gray-500 italic">Indian mandi data pending for {selectedCommodityName}</p>
                })()}

                {/* International Benchmark (for Coffee) */}
                {selectedBenchmark && (
                  <div className="bg-white rounded p-2 border border-purple-200">
                    <p className="text-xs text-gray-600">🌍 {translate('ICE Futures (NY)', 'ICE ಫ್ಯೂಚರ್ಸ್ (NY)')}</p>
                    <p className="text-lg font-semibold text-purple-700">{formatInr(selectedBenchmark.inrPerKg)}</p>
                    <p className="text-xs text-gray-500">{selectedBenchmark.source}</p>
                    {market?.fx && (
                      <p className="text-xs text-gray-500">
                        FX: ₹{market.fx.usdToInr.toFixed(2)}/$ ({market.fx.source})
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Price Disclaimer */}
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs text-amber-900 font-semibold mb-1">
                  ⚠️ {translate('Why prices differ from Google/other sources:', 'ಗೂಗಲ್/ಇತರೆ ಮೂಲಗಳಿಗಿಂತ ಏಕೆ ವ್ಯತ್ಯಾಸವಿದೆ:')}
                </p>
                <ul className="text-xs text-amber-800 space-y-1 ml-4 list-disc">
                  <li>{translate('We show wholesale/mandi rates; Google may show retail prices', 'ನಾವು ಸಗಟು/ಮಾಂಡಿ ದರಗಳನ್ನು ತೋರಿಸುತ್ತೇವೆ; ಗೂಗಲ್ ಚಿಲ್ಲರೆ ಬೆಲೆಗಳನ್ನು ತೋರಿಸಬಹುದು')}</li>
                  <li>{translate('Coffee: Futures contracts (3-6 months forward) vs spot prices', 'ಕಾಫಿ: ಫ್ಯೂಚರ್ಸ್ ಒಪ್ಪಂದಗಳು (3-6 ತಿಂಗಳು ಮುಂದೆ) vs ಸ್ಪಾಟ್ ಬೆಲೆಗಳು')}</li>
                  <li>{translate('Real-time forex rates applied (not static conversion)', 'ನೈಜ-ಸಮಯದ ವಿದೇಶಿ ವಿನಿಮಯ ದರಗಳನ್ನು ಅನ್ವಯಿಸಲಾಗಿದೆ')}</li>
                  <li>{translate('Grade differences: Premium vs commercial quality', 'ಗುಣಮಟ್ಟ ವ್ಯತ್ಯಾಸಗಳು: ಪ್ರೀಮಿಯಂ vs ವಾಣಿಜ್ಯ')}</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <p className="text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {translate(`Per Bag (${bagKg} kg)`, `ಪ್ರತಿ ಬ್ಯಾಗ್ (${bagKg} ಕೆಜಿ)`)}: <span className="font-semibold">{formatCurrency(displayPerBag, '/bag')}</span>
                </p>
                <p className="text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {translate('Kodagu Mandi Standard (Quintal)', 'ಕೊಡಗು ಮಾರುಕಟ್ಟೆ ಮಾನದಂಡ (ಕ್ವಿಂಟಲ್)')}: <span className="font-semibold">{formatCurrency(displayPerQuintal, '/quintal')}</span>
                </p>
              </div>
              <p className="text-gray-500 text-sm">{translate('Local insight', 'ಸ್ಥಳೀಯ ಮಾಹಿತಿ')}: {insights[selectedCommodityName] || translate('Analyzing trend...', 'ಟ್ರೆಂಡ್ ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...')}</p>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 space-y-2">
                <p className="text-sm text-emerald-900 font-semibold">
                  {translate('Recommended Action', 'ಶಿಫಾರಸು ಮಾಡಿದ ಕ್ರಮ')}: {recommendation.action}
                </p>
                <p className="text-sm text-emerald-800">{recommendation.note}</p>
                {'detail' in recommendation && <p className="text-xs text-emerald-700 italic">{recommendation.detail}</p>}
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 p-4">
                <p className="text-sm text-indigo-900 font-semibold">
                  {translate('Best Time to Sell', 'ಮಾರಾಟಕ್ಕೆ ಉತ್ತಮ ಸಮಯ')}
                </p>
                <p className="text-sm text-indigo-800 mt-1">
                  {bestTimeToSellText(recommendation.signal, selectedForecastHorizon?.range.pctMove ?? null)}
                </p>
              </div>
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <span className="font-semibold">{translate('Algorithm Forecast', 'ಅಲ್ಗಾರಿದಮ್ ಮುನ್ಸೂಚನೆ')}:</span> {translate(`Next ${selectedHorizon} days`, `ಮುಂದಿನ ${selectedHorizon} ದಿನ`)}: <span className="font-semibold">{simpleDirection(selectedForecastHorizon?.range.pctMove ?? null)}</span>
                {selectedForecastHorizon?.range.pctMove != null ? ` (${selectedForecastHorizon.range.pctMove > 0 ? '+' : ''}${selectedForecastHorizon.range.pctMove.toFixed(1)}%)` : ''}
                {' • '}
                {translate('Weighted ensemble of Linear Regression, Holt Smoothing & Ridge AR models', 'ರೇಖೀಯ, ಹೋಲ್ಟ್ ಮತ್ತು ರಿಡ್ಜ್ ಮಾದರಿಗಳ ಸಂಯೋಜನೆ')}
              </p>
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <span className="font-semibold">{translate('Confidence Interval (80%)', '80% ವಿಶ್ವಾಸ ಮಧ್ಯಂತರ')}:</span> {selectedForecastHorizon?.range.lowerPct != null ? `${selectedForecastHorizon.range.lowerPct > 0 ? '+' : ''}${selectedForecastHorizon.range.lowerPct.toFixed(1)}%` : '-'} to {selectedForecastHorizon?.range.upperPct != null ? `${selectedForecastHorizon.range.upperPct > 0 ? '+' : ''}${selectedForecastHorizon.range.upperPct.toFixed(1)}%` : '-'}
                {' • '}
                {translate('Derived from 10th-90th percentile residuals across rolling backtest', 'ರೋಲಿಂಗ್ ಬ್ಯಾಕ್‌ಟೆಸ್ಟ್ ಶೇಷಗಳಿಂದ ಪಡೆದುಕೊಂಡಿದೆ')}
                {' • '}
                {confidenceLabel(selectedForecastHorizon?.metrics.mape ?? null)}
              </p>

              <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
                <p className="text-xs text-gray-600 font-semibold mb-1">📡 Data Sources & Freshness:</p>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>• <span className="font-semibold">Primary:</span> {selectedCommodity?.source || 'Aggregated observations'}</p>
                  {indianMarkets?.updatedAtIst && <p>• <span className="font-semibold">Indian Mandis:</span> {indianMarkets.updatedAtIst}</p>}
                  {market?.updatedAtIst && <p>• <span className="font-semibold">ICE Futures:</span> {market.updatedAtIst}</p>}
                  {market?.fx && <p>• <span className="font-semibold">Forex:</span> ₹{market.fx.usdToInr.toFixed(2)}/$ ({market.fx.source})</p>}
                  <p>• <span className="font-semibold">Models:</span> {translate('Linear OLS, Holt (α/β tuned), Ridge AR(5) with inverse-MAE weighting', 'ರೇಖೀಯ OLS, ಹೋಲ್ಟ್ (α/β ಟ್ಯೂನ್ ಮಾಡಲಾಗಿದೆ), ರಿಡ್ಜ್ AR(5)')}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAdvanced(v => !v)
                  trackEvent('toggle_technical_details', { meta: { next: !showAdvanced } })
                }}
                className="lux-btn-ghost text-sm font-semibold"
              >
                {showAdvanced
                  ? translate('Hide technical details', 'ತಾಂತ್ರಿಕ ವಿವರಗಳನ್ನು ಮರೆಮಾಡಿ')
                  : translate('Show technical details', 'ತಾಂತ್ರಿಕ ವಿವರಗಳನ್ನು ತೋರಿಸಿ')}
              </button>

              {showAdvanced && selectedForecast && selectedForecastHorizon && (
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                  <p><span className="font-semibold">Model:</span> {selectedForecast.modelVersion} (Ensemble: Linear + Holt + Ridge)</p>
                  <p><span className="font-semibold">Backtest Performance:</span>
                    {selectedForecastHorizon.metrics.mape != null ? ` MAPE ${selectedForecastHorizon.metrics.mape.toFixed(2)}%` : ''}
                    {selectedForecastHorizon.metrics.mae != null ? ` • MAE ₹${selectedForecastHorizon.metrics.mae.toFixed(2)}/kg` : ''}
                    {selectedForecastHorizon.metrics.rmse != null ? ` • RMSE ₹${selectedForecastHorizon.metrics.rmse.toFixed(2)}/kg` : ''}
                  </p>
                  <p><span className="font-semibold">Regime:</span> {selectedForecastHorizon.diagnostics.regime} (volatility classification based on rolling std dev)</p>
                  <p><span className="font-semibold">Ensemble Weights:</span>
                    {` Linear ${(selectedForecastHorizon.diagnostics.ensembleWeightLinear * 100).toFixed(1)}%`}
                    {` • Holt ${(selectedForecastHorizon.diagnostics.ensembleWeightHolt * 100).toFixed(1)}%`}
                    {selectedForecastHorizon.diagnostics.ensembleWeightRidge ? ` • Ridge ${(selectedForecastHorizon.diagnostics.ensembleWeightRidge * 100).toFixed(1)}%` : ''}
                  </p>
                  <p className="text-xs italic">Weights computed via inverse MAE from rolling out-of-sample validation</p>
                </div>
              )}
            </div>

            {marketError && <p className="text-sm text-red-600">{marketError}</p>}
            {indianMarketsError && <p className="text-sm text-orange-600">{indianMarketsError}</p>}
            {forecastError && <p className="text-sm text-red-600">{forecastError}</p>}
            {leaderboardError && <p className="text-sm text-red-600">{leaderboardError}</p>}

            {showAdvanced && selectedLeaderboard && (
              <div className="glass rounded-2xl p-5 shadow">
                <h3 className="font-luxe text-xl font-semibold text-[#2a1b15] dark:text-[#f6e8d7] mb-2">Model Leaderboard (Out-of-Sample, {selectedHorizon}D)</h3>
                <div className="space-y-2 text-sm">
                  {selectedLeaderboard.ranking.map((row, idx) => (
                    <div key={row.modelVersion} className="flex flex-wrap gap-3 items-center rounded-lg border border-gray-200 px-3 py-2">
                      <span className="font-semibold text-gray-800">#{idx + 1} {row.modelVersion}</span>
                      <span className="text-gray-600">MAPE: {row.mape != null ? `${row.mape.toFixed(2)}%` : '-'}</span>
                      <span className="text-gray-600">MAE: {row.mae != null ? row.mae.toFixed(2) : '-'}</span>
                      <span className="text-gray-600">RMSE: {row.rmse != null ? row.rmse.toFixed(2) : '-'}</span>
                      <span className="text-gray-500">Samples: {row.sampleCount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass rounded-2xl p-5 shadow">
              <h3 className="font-luxe text-xl font-semibold text-[#2a1b15] dark:text-[#f6e8d7] mb-3">Price Trend (INR/kg)</h3>
              {selectedForecastHorizon ? (
                <Line
                  data={{
                    labels: selectedForecastHorizon.labels,
                    datasets: [
                      {
                        label: 'Confidence Lower',
                        data: selectedForecastHorizon.lowerSeries,
                        borderColor: 'rgba(59,130,246,0.3)',
                        backgroundColor: 'rgba(59,130,246,0.12)',
                        pointRadius: 0,
                        tension: 0.3,
                      },
                      {
                        label: 'Confidence Upper',
                        data: selectedForecastHorizon.upperSeries,
                        borderColor: 'rgba(59,130,246,0.3)',
                        backgroundColor: 'rgba(59,130,246,0.12)',
                        pointRadius: 0,
                        fill: '-1',
                        tension: 0.3,
                      },
                      {
                        label: `${selectedCommodityName} Actual (₹/kg)`,
                        data: selectedForecastHorizon.actualSeries,
                        borderColor: 'rgb(16,185,129)',
                        backgroundColor: 'rgba(16,185,129,0.2)',
                        tension: 0.3,
                      },
                      {
                        label: `${selectedCommodityName} Forecast (₹/kg)`,
                        data: selectedForecastHorizon.forecastSeries,
                        borderColor: 'rgb(59,130,246)',
                        backgroundColor: 'rgba(59,130,246,0.2)',
                        borderDash: [6, 4],
                        tension: 0.3,
                      },
                    ],
                  }}
                  options={{ responsive: true, plugins: { legend: { position: 'top' } } }}
                />
              ) : (
                <p className="text-sm text-gray-500">No historical data available for this commodity yet.</p>
              )}
            </div>
          </section>
        )}
      </div>

      <Footer />
    </div>
  )
}
