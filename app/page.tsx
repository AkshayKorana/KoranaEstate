'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
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
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { getStandardBagWeightKg, toInrPerBag, toInrPerQuintal } from '@/lib/india-market'

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
  price: number
  quantity: number
  location?: string
}

interface MarketPoint {
  date: string
  inrPerKg: number
}

interface MarketQuote {
  usdPerLb: number | null
  inrPerKg: number | null
  history?: MarketPoint[]
}

interface MarketResponse {
  arabica: MarketQuote
  robusta: MarketQuote
  updatedAt: string
  updatedAtIst?: string
  source: string
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
  { group: 'Coffee Varieties', names: ['Arabica', 'Robusta'] },
  { group: 'Spices', names: ['Pepper', 'Cardamom'] },
] as const

type UiLang = 'en' | 'kn'
type ActionSignal = 'SELL_NOW' | 'WAIT' | 'HOLD'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'Marketplace' | 'Dashboard'>('Marketplace')
  const [selectedCommodityName, setSelectedCommodityName] = useState<string>('Arabica')
  const [selectedHorizon, setSelectedHorizon] = useState<number>(3)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [uiLang, setUiLang] = useState<UiLang>('en')

  const [items] = useState<MarketplaceItem[]>([
    { id: '1', name: 'Arabica Coffee', type: 'Coffee', price: 520, quantity: 50, location: 'Coorg' },
    { id: '2', name: 'Robusta Coffee', type: 'Coffee', price: 450, quantity: 30, location: 'Chikmagalur' },
    { id: '3', name: 'Pepper', type: 'Spice', price: 650, quantity: 20, location: 'Kerala' },
    { id: '4', name: 'Cardamom', type: 'Spice', price: 1200, quantity: 15, location: 'Kerala' },
  ])

  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [insights, setInsights] = useState<Record<string, string>>({})
  const [market, setMarket] = useState<MarketResponse | null>(null)
  const [marketError, setMarketError] = useState<string | null>(null)
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
    async function fetchCommodities() {
      try {
        const res = await fetch('/api/commodities')
        const json: APIResponse = await res.json()
        setCommodities(json.data)
        setInsights(json.insights)

        const preferred = ['Arabica', 'Robusta', 'Pepper', 'Cardamom']
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
        const names = ['Arabica', 'Robusta', 'Pepper', 'Cardamom'].join(',')
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
        const names = ['Arabica', 'Robusta', 'Pepper', 'Cardamom'].join(',')
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
        if (!res.ok) throw new Error(`Failed with status ${res.status}`)
        const json: MarketResponse = await res.json()
        setMarket(json)
        setMarketError(null)
      } catch (err) {
        console.error(err)
        setMarketError('Unable to load live benchmark prices right now.')
      }
    }

    fetchMarketPrices()
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
        note: translate('Data is still building. Check again tomorrow morning.', 'ಡೇಟಾ ಇನ್ನೂ ಸೇರುತ್ತಿದೆ. ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಮತ್ತೆ ನೋಡಿ.'),
      }
    }
    if (pctMove <= -2.0) {
      return {
        signal: 'SELL_NOW' as ActionSignal,
        action: translate('SELL NOW', 'ಈಗಲೇ ಮಾರಾಟ ಮಾಡಿ'),
        note: translate('Prices may soften soon. Consider selling current stock.', 'ಬೆಲೆಗಳು ಕುಸಿಯುವ ಸಾಧ್ಯತೆ ಇದೆ. ಪ್ರಸ್ತುತ ಸ್ಟಾಕ್ ಮಾರಾಟ ಮಾಡಲು ಪರಿಗಣಿಸಿ.'),
      }
    }
    if (pctMove >= 2.0) {
      return {
        signal: 'WAIT' as ActionSignal,
        action: translate('WAIT', 'ಕಾಯಿರಿ'),
        note: translate('Upward trend likely. Holding for a few days may help.', 'ಬೆಲೆ ಏರಿಕೆ ಸಾಧ್ಯತೆ ಇದೆ. ಕೆಲವು ದಿನ ಕಾಯುವುದು ಲಾಭಕರವಾಗಬಹುದು.'),
      }
    }
    return {
      signal: 'HOLD' as ActionSignal,
      action: translate('HOLD', 'ನಿರೀಕ್ಷಿಸಿ'),
      note: translate('Only small movement expected. Sell only if cash is needed.', 'ಸ್ವಲ್ಪ ಚಲನೆ ಮಾತ್ರ ನಿರೀಕ್ಷೆ. ತುರ್ತು ಹಣ ಬೇಕಿದ್ದರೆ ಮಾತ್ರ ಮಾರಾಟ ಮಾಡಿ.'),
    }
  }

  const recommendation = actionRecommendation(
    selectedForecastHorizon?.range.pctMove ?? null,
    selectedForecastHorizon?.metrics.mape ?? null
  )

  function bestTimeToSellText(signal: ActionSignal, pctMove: number | null) {
    if (signal === 'SELL_NOW') {
      return translate(
        'Best time to sell: Today or within 24 hours.',
        'ಮಾರಾಟಕ್ಕೆ ಉತ್ತಮ ಸಮಯ: ಇಂದು ಅಥವಾ ಮುಂದಿನ 24 ಗಂಟೆಗಳ ಒಳಗೆ.'
      )
    }
    if (signal === 'WAIT') {
      return translate(
        'Best time to sell: Wait 2-3 days and review again.',
        'ಮಾರಾಟಕ್ಕೆ ಉತ್ತಮ ಸಮಯ: 2-3 ದಿನ ಕಾಯ್ದು ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ.'
      )
    }
    const move = pctMove == null ? '' : ` (${pctMove.toFixed(1)}%)`
    return translate(
      `Best time to sell: Flexible this week${move}.`,
      `ಮಾರಾಟಕ್ಕೆ ಉತ್ತಮ ಸಮಯ: ಈ ವಾರ ಯಾವುದೇ ದಿನ ಸೂಕ್ತ${move}.`
    )
  }

  return (
    <div id="top" className="space-y-12">
      <Navbar />

      <div className="pt-24">
        <Hero />
      </div>

      <div className="container mx-auto px-6 space-y-6">
        <div className="flex space-x-4 border-b-2 border-gray-200">
          <button
            className={`px-5 py-2 font-semibold rounded-t-xl transition-all ${activeTab === 'Marketplace' ? 'bg-white text-emerald-600 shadow-md border-t-4 border-emerald-500' : 'text-gray-500 hover:text-emerald-600'}`}
            onClick={() => {
              setActiveTab('Marketplace')
              trackEvent('tab_change', { meta: { tab: 'Marketplace' } })
            }}
          >
            Marketplace
          </button>
          <button
            className={`px-5 py-2 font-semibold rounded-t-xl transition-all ${activeTab === 'Dashboard' ? 'bg-white text-purple-600 shadow-md border-t-4 border-purple-500' : 'text-gray-500 hover:text-purple-600'}`}
            onClick={() => {
              setActiveTab('Dashboard')
              trackEvent('tab_change', { meta: { tab: 'Dashboard' } })
            }}
          >
            AI / Commodity Dashboard
          </button>
        </div>

        {activeTab === 'Marketplace' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item => (
              <div key={item.id} className="bg-black/20 backdrop-blur-md p-6 rounded-2xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1">
                <h3 className="text-xl font-bold text-white mb-1">{item.name}</h3>
                <span className="inline-block mb-2 px-3 py-1 text-sm font-medium bg-gradient-to-r from-green-400 to-green-600 text-white rounded-full">{item.type}</span>
                <p className="text-white/90 font-semibold">Price: ₹{item.price.toLocaleString()}</p>
                <p className="text-white/80">Qty: {item.quantity}</p>
                <p className="text-white/70">Location: {item.location || 'India'}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow"
                    onClick={() => trackEvent('marketplace_buy_click', { commodity: item.name, meta: { itemId: item.id, price: item.price } })}
                  >
                    Buy
                  </button>
                  <button
                    className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow"
                    onClick={() => trackEvent('marketplace_sell_click', { commodity: item.name, meta: { itemId: item.id, price: item.price } })}
                  >
                    Sell
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Dashboard' && (
          <section className="bg-gray-50 p-6 rounded-2xl shadow-lg space-y-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-gray-800">{translate('Commodity Price Assistant', 'ಬೆಳೆ ಬೆಲೆ ಸಹಾಯಕ')}</h2>
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
                <button
                  type="button"
                  onClick={() => {
                    setUiLang('en')
                    trackEvent('language_change', { meta: { lang: 'en' } })
                  }}
                  className={`px-3 py-1 text-sm font-semibold rounded ${uiLang === 'en' ? 'bg-emerald-600 text-white' : 'text-gray-700'}`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUiLang('kn')
                    trackEvent('language_change', { meta: { lang: 'kn' } })
                  }}
                  className={`px-3 py-1 text-sm font-semibold rounded ${uiLang === 'kn' ? 'bg-emerald-600 text-white' : 'text-gray-700'}`}
                >
                  ಕನ್ನಡ
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {translate(
                "Pick a crop to see today's price, likely movement, and simple trend chart.",
                'ಇಂದಿನ ಬೆಲೆ, ಮುಂದಿನ ಚಲನೆ ಮತ್ತು ಸರಳ ಟ್ರೆಂಡ್ ಗ್ರಾಫ್ ನೋಡಲು ಬೆಳೆ ಆಯ್ಕೆಮಾಡಿ.'
              )}
            </p>

            <div className="max-w-sm">
              <label htmlFor="commodity-select" className="block text-sm font-medium text-gray-700 mb-2">
                {translate('Choose Crop', 'ಬೆಳೆ ಆಯ್ಕೆಮಾಡಿ')}
              </label>
              <select
                id="commodity-select"
                className="w-full border p-3 rounded-xl text-gray-700 font-medium"
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
              <span className="text-sm font-medium text-gray-700">Prediction Window:</span>
              {[3, 7].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setSelectedHorizon(h)
                    trackEvent('horizon_change', { horizonDays: h })
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${selectedHorizon === h ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
                >
                  {translate(`${h} Days`, `${h} ದಿನ`)}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-lg space-y-3">
              <h3 className="font-bold text-xl text-gray-800">{selectedCommodityName}</h3>
              <p className="text-gray-700 text-lg font-semibold">{translate("Today's Price", 'ಇಂದಿನ ಬೆಲೆ')}: {formatInr(displayedPrice)}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <p className="text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {translate(`Per Bag (${bagKg} kg)`, `ಪ್ರತಿ ಬ್ಯಾಗ್ (${bagKg} ಕೆಜಿ)`)}: <span className="font-semibold">{formatCurrency(displayPerBag, '/bag')}</span>
                </p>
                <p className="text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  {translate('Kodagu Mandi Standard (Quintal)', 'ಕೊಡಗು ಮಾರುಕಟ್ಟೆ ಮಾನದಂಡ (ಕ್ವಿಂಟಲ್)')}: <span className="font-semibold">{formatCurrency(displayPerQuintal, '/quintal')}</span>
                </p>
              </div>
              <p className="text-gray-500 text-sm">{translate('Local insight', 'ಸ್ಥಳೀಯ ಮಾಹಿತಿ')}: {insights[selectedCommodityName] || translate('Analyzing trend...', 'ಟ್ರೆಂಡ್ ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...')}</p>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-900 font-semibold">
                  {translate('Recommended Action', 'ಶಿಫಾರಸು ಮಾಡಿದ ಕ್ರಮ')}: {recommendation.action}
                </p>
                <p className="text-sm text-emerald-800 mt-1">{recommendation.note}</p>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-sm text-indigo-900 font-semibold">
                  {translate('Best Time to Sell', 'ಮಾರಾಟಕ್ಕೆ ಉತ್ತಮ ಸಮಯ')}
                </p>
                <p className="text-sm text-indigo-800 mt-1">
                  {bestTimeToSellText(recommendation.signal, selectedForecastHorizon?.range.pctMove ?? null)}
                </p>
              </div>
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                {translate(`Expected direction for next ${selectedHorizon} days`, `ಮುಂದಿನ ${selectedHorizon} ದಿನಗಳ ದಿಕ್ಕು`)}: <span className="font-semibold">{simpleDirection(selectedForecastHorizon?.range.pctMove ?? null)}</span>
                {selectedForecastHorizon?.range.pctMove != null ? ` (${selectedForecastHorizon.range.pctMove.toFixed(1)}%)` : ''}
              </p>
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Possible movement range: {selectedForecastHorizon?.range.lowerPct != null ? `${selectedForecastHorizon.range.lowerPct.toFixed(1)}%` : '-'} to {selectedForecastHorizon?.range.upperPct != null ? `${selectedForecastHorizon.range.upperPct.toFixed(1)}%` : '-'}
                {' • '}
                {confidenceLabel(selectedForecastHorizon?.metrics.mape ?? null)}
              </p>

              {selectedBenchmark && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
                  Reference Market Price: {formatInr(selectedBenchmark.inrPerKg)}
                </div>
              )}

              <p className="text-xs text-gray-500">
                Source: {selectedCommodity?.source || market?.source || 'Market feed'}
                {market?.updatedAtIst ? ` • Updated (IST): ${market.updatedAtIst}` : ''}
              </p>

              <button
                type="button"
                onClick={() => {
                  setShowAdvanced(v => !v)
                  trackEvent('toggle_technical_details', { meta: { next: !showAdvanced } })
                }}
                className="text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                {showAdvanced
                  ? translate('Hide technical details', 'ತಾಂತ್ರಿಕ ವಿವರಗಳನ್ನು ಮರೆಮಾಡಿ')
                  : translate('Show technical details', 'ತಾಂತ್ರಿಕ ವಿವರಗಳನ್ನು ತೋರಿಸಿ')}
              </button>

              {showAdvanced && selectedForecast && selectedForecastHorizon && (
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  Model: {selectedForecast.modelVersion}
                  {selectedForecastHorizon.metrics.mape != null ? ` • MAPE: ${selectedForecastHorizon.metrics.mape.toFixed(1)}%` : ''}
                  {selectedForecastHorizon.metrics.rmse != null ? ` • RMSE: ${selectedForecastHorizon.metrics.rmse.toFixed(2)}` : ''}
                  {` • Regime: ${selectedForecastHorizon.diagnostics.regime}`}
                </div>
              )}
            </div>

            {marketError && <p className="text-sm text-red-600">{marketError}</p>}
            {forecastError && <p className="text-sm text-red-600">{forecastError}</p>}
            {leaderboardError && <p className="text-sm text-red-600">{leaderboardError}</p>}

            {showAdvanced && selectedLeaderboard && (
              <div className="rounded-2xl bg-white p-5 shadow">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Model Leaderboard (Out-of-Sample, {selectedHorizon}D)</h3>
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

            <div className="rounded-2xl bg-white p-5 shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Price Trend (INR/kg)</h3>
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
