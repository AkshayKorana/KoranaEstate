'use client'

import { useEffect, useMemo, useState } from 'react'
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
import Footer from './components/Footer'
import { useLanguage } from './language-context'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)
const Line = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), { ssr: false })

type ProductStatus = 'OK' | 'FAILED'
type ProductReason = 'NO_DATA' | 'MISSING_IN_RUN' | string | null

type PriceProduct = {
  productKey: string
  displayName: string
  unit: string
  defaultSource: string | null
  sourceUrl: string | null
  displayOrder: number
  enabled: boolean
}

type InsightPoint = {
  label?: string
  date?: string
  day?: string
  value?: number | null
}

type InsightSource = {
  title?: string
  url: string
  host?: string
}

type PriceLatestCard = {
  productKey: string
  displayName: string
  unit: string
  status: ProductStatus
  value: number | null
  reason: ProductReason
  source: string | null
  sourceUrl: string | null
  confidence: number | null
  rawText: string | null
  error: string | null
  capturedAt: string | null
  currentPrice?: number | null
  lastWeekPrice?: number | null
  lastWeekPriceMin?: number | null
  lastWeekPriceMax?: number | null
  todayPrice?: number | null
  todayPriceMin?: number | null
  todayPriceMax?: number | null
  expectedNextPrice?: number | null
  expectedNextPriceMin?: number | null
  expectedNextPriceMax?: number | null
  shortDescription?: string | null
  trend?: string | null
  analysisSummary?: string | null
  analysisBullets?: string[]
  historicalPoints?: InsightPoint[]
  forecastPoints?: InsightPoint[]
  metadata?: Record<string, unknown> | null
  sources?: InsightSource[]
}

type PricesProductsResponse = {
  updatedAt: string
  products: PriceProduct[]
}

type PricesLatestResponse = {
  updatedAt: string
  run: {
    id: string
    runAt: string
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED'
    totalProducts: number
    successfulCount: number
    failedCount: number
    trigger: string
    createdAt: string
  } | null
  lastSuccessfulRun: {
    id: string
    runAt: string
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED'
    totalProducts: number
    successfulCount: number
    failedCount: number
    trigger: string
    createdAt: string
  } | null
  runHealth: {
    stale: boolean
    staleReason: string | null
    freshnessHours: number | null
    maxFreshnessHours: number
    scheduleTimeLocal: string
    scheduleTimezone: string
    latestRunStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED' | null
    latestRunAt: string | null
    lastSuccessfulRunAt: string | null
  }
  products: PriceLatestCard[]
}

type PriceHistoryPoint = {
  capturedAt: string
  status: ProductStatus
  value: number | null
  unit: string
  source: string | null
  sourceUrl: string | null
  confidence: number | null
  rawText: string | null
  error: string | null
  runId: string
  runAt: string
  runStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED'
}

type PricesHistoryResponse = {
  updatedAt: string
  product: PriceProduct
  days: number
  summary: {
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    latestCapturedAt: string | null
    latestSuccessfulCapturedAt: string | null
  }
  history: PriceHistoryPoint[]
  daily: PriceHistoryPoint[]
}

function formatPrice(value: number | null | undefined) {
  return value != null ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'
}

function formatValueOrNotAvailable(value: string | null | undefined) {
  return value && value.trim() ? value : 'Not available'
}

function formatRangeOrValue(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined
) {
  if (min != null && max != null) {
    return `${formatPrice(min)} - ${formatPrice(max)}`
  }
  if (value != null) {
    return formatPrice(value)
  }
  return 'Not available'
}

function formatPointLabel(point: InsightPoint, fallbackIndex: number) {
  if (point.label) return point.label
  if (point.day) return point.day
  if (point.date) return new Date(point.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  return `Point ${fallbackIndex + 1}`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanHighlightLine(line: string) {
  return line.replace(/\s+/g, ' ').trim()
}

function isUsefulHighlightLine(line: string) {
  const cleaned = cleanHighlightLine(line)
  if (!cleaned || cleaned.length < 24 || cleaned.length > 220) return false
  if (/^(privacy|terms|skip to content|images|videos|maps|news|shopping|allsearchimages)/i.test(cleaned)) return false
  if (/^https?:\/\//i.test(cleaned)) return false
  if (/^[A-Z0-9\s|:.-]{18,}$/.test(cleaned)) return false
  if (!/[a-z]/i.test(cleaned)) return false
  return true
}

function pickHighlightSentences(rawText: string | null | undefined, displayName: string | null | undefined) {
  if (!rawText) return []

  const productPattern = displayName ? new RegExp(escapeRegExp(displayName), 'i') : null
  const priorityPatterns = [
    /\b(today|current|latest|price|priced|traded|trading)\b/i,
    /\b(last week|previous week|week ago|compared with last week)\b/i,
    /\b(next week|forecast|expected|outlook|may|likely|could)\b/i,
    /\b(trend|firm|steady|up|down|rise|fall|increase|decrease)\b/i,
    /\b(demand|supply|rain|crop|arrival|market|export|quality)\b/i,
  ]

  const lines = rawText
    .split(/\n+/)
    .map(cleanHighlightLine)
    .filter(isUsefulHighlightLine)

  const selected: string[] = []
  const seen = new Set<string>()

  for (const pattern of priorityPatterns) {
    const match = lines.find((line) => {
      if (seen.has(line.toLowerCase())) return false
      if (!pattern.test(line)) return false
      if (productPattern && !productPattern.test(line) && /coffee/i.test(line) && !/\barabica|robusta\b/i.test(line)) {
        return false
      }
      return true
    })

    if (match) {
      const key = match.toLowerCase()
      seen.add(key)
      selected.push(match)
    }
  }

  return selected
}

export default function HomePage() {
  const { t } = useLanguage()

  const [products, setProducts] = useState<PriceProduct[]>([])
  const [latest, setLatest] = useState<PricesLatestResponse | null>(null)
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [history, setHistory] = useState<PricesHistoryResponse | null>(null)

  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingLatest, setLoadingLatest] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [productsError, setProductsError] = useState<string | null>(null)
  const [latestError, setLatestError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadLatestData() {
      try {
        const latestRes = await fetch('/api/prices/latest', { cache: 'no-store' })
        if (!latestRes.ok) {
          const payload = await latestRes.json().catch(() => ({}))
          throw new Error(payload?.message || `Latest request failed (${latestRes.status})`)
        }

        const latestPayload: PricesLatestResponse = await latestRes.json()
        if (!mounted) return
        setLatest(latestPayload)
        setLatestError(null)
      } catch (error) {
        if (!mounted) return
        const message = error instanceof Error ? error.message : 'Failed to refresh latest prices.'
        setLatestError(message)
      } finally {
        if (!mounted) return
        setLoadingLatest(false)
      }
    }

    async function load() {
      setLoadingProducts(true)
      setLoadingLatest(true)
      setProductsError(null)
      setLatestError(null)

      try {
        const productsRes = await fetch('/api/prices/products', { cache: 'no-store' })

        if (!productsRes.ok) {
          const payload = await productsRes.json().catch(() => ({}))
          throw new Error(payload?.message || `Products request failed (${productsRes.status})`)
        }

        const productsPayload: PricesProductsResponse = await productsRes.json()

        if (!mounted) return

        setProducts(productsPayload.products)

        if (productsPayload.products.length > 0) {
          setSelectedKey((current) => current || productsPayload.products[0].productKey)
        }

        await loadLatestData()
      } catch (error) {
        if (!mounted) return
        const message = error instanceof Error ? error.message : 'Failed to load price dashboard data.'
        setProductsError(message)
        setLatestError(message)
      } finally {
        if (!mounted) return
        setLoadingProducts(false)
        setLoadingLatest(false)
      }
    }

    load()
    const intervalId = window.setInterval(() => {
      void loadLatestData()
    }, 30_000)

    return () => {
      mounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!selectedKey) {
      setHistory(null)
      return
    }

    let mounted = true
    async function loadHistory() {
      setLoadingHistory(true)
      setHistoryError(null)
      try {
        const res = await fetch(`/api/prices/history?days=30&productKey=${encodeURIComponent(selectedKey)}`, {
          cache: 'no-store',
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload?.message || `History request failed (${res.status})`)
        }
        const payload: PricesHistoryResponse = await res.json()
        if (!mounted) return
        setHistory(payload)
      } catch (error) {
        if (!mounted) return
        setHistory(null)
        setHistoryError(error instanceof Error ? error.message : 'Failed to load history.')
      } finally {
        if (!mounted) return
        setLoadingHistory(false)
      }
    }

    loadHistory()
    return () => {
      mounted = false
    }
  }, [selectedKey])

  const latestByKey = useMemo(() => {
    const map = new Map<string, PriceLatestCard>()
    for (const row of latest?.products || []) {
      map.set(row.productKey, row)
    }
    return map
  }, [latest])

  const selectedProduct = useMemo(
    () => products.find((product) => product.productKey === selectedKey) || null,
    [products, selectedKey]
  )

  const selectedLatest = useMemo(
    () => latestByKey.get(selectedKey) || null,
    [latestByKey, selectedKey]
  )

  const dbHistoryChart = useMemo(() => {
    const historicalPoints = (history?.daily || history?.history || []).filter((point) => point.value != null)
    const forecastPoints = (selectedLatest?.forecastPoints || []).filter((point) => point.value != null)

    if (historicalPoints.length === 0 && forecastPoints.length === 0) {
      return null
    }

    const labels = [
      ...historicalPoints.map((point, index) =>
        new Date(point.capturedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) || formatPointLabel(point, index)
      ),
      ...forecastPoints.map((point, index) => formatPointLabel(point, historicalPoints.length + index)),
    ]

    return {
      labels,
      historicalSeries: [
        ...historicalPoints.map((point) => point.value),
        ...forecastPoints.map(() => null),
      ],
      forecastSeries: [
        ...historicalPoints.map(() => null),
        ...forecastPoints.map((point) => point.value ?? null),
      ],
    }
  }, [history, selectedLatest])

  const fallbackHistoryChart = useMemo(() => {
    const chartPoints = (history?.history || []).filter((point) => point.value != null)
    if (chartPoints.length === 0) {
      return null
    }

    return {
      labels: chartPoints.map((point) =>
        new Date(point.capturedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      ),
      series: chartPoints.map((point) => point.value),
    }
  }, [history])

  const chartConfig = dbHistoryChart || fallbackHistoryChart
  const hasRichDetail = Boolean(
    selectedLatest?.analysisSummary ||
    selectedLatest?.shortDescription ||
    selectedLatest?.analysisBullets?.length ||
    selectedLatest?.sources?.length
  )
  const lastUpdated = latest?.run?.runAt || latest?.updatedAt || null
  const latestPriceDisplay = formatRangeOrValue(
    selectedLatest?.todayPrice ?? selectedLatest?.currentPrice ?? selectedLatest?.value,
    selectedLatest?.todayPriceMin,
    selectedLatest?.todayPriceMax
  )
  const currentEquivalentDisplay = selectedLatest?.currentPrice != null || selectedLatest?.value != null
    ? `${formatPrice(selectedLatest?.currentPrice ?? selectedLatest?.value)} ${selectedLatest?.unit || selectedProduct?.unit || 'INR/kg'}`
    : 'Not available'
  const lastWeekDisplay = formatRangeOrValue(
    selectedLatest?.lastWeekPrice,
    selectedLatest?.lastWeekPriceMin,
    selectedLatest?.lastWeekPriceMax
  )
  const nextWeekDisplay = formatRangeOrValue(
    selectedLatest?.expectedNextPrice,
    selectedLatest?.expectedNextPriceMin,
    selectedLatest?.expectedNextPriceMax
  )
  const trendDisplay = formatValueOrNotAvailable(selectedLatest?.trend)
  const confidenceDisplay =
    selectedLatest?.confidence != null ? `${Math.round(selectedLatest.confidence * 100)}%` : 'Not available'
  const recentDailyHistory = useMemo(
    () => [...(history?.daily || [])].reverse().slice(0, 7),
    [history]
  )
  const derivedHighlights = useMemo(() => {
    const normalized = new Set<string>()
    const items: string[] = []

    for (const bullet of selectedLatest?.analysisBullets || []) {
      const cleaned = cleanHighlightLine(bullet)
      if (!isUsefulHighlightLine(cleaned)) continue
      const key = cleaned.toLowerCase()
      if (normalized.has(key)) continue
      normalized.add(key)
      items.push(cleaned)
    }

    const summary = cleanHighlightLine(selectedLatest?.analysisSummary || selectedLatest?.shortDescription || '')
    if (isUsefulHighlightLine(summary)) {
      const key = summary.toLowerCase()
      if (!normalized.has(key)) {
        normalized.add(key)
        items.push(summary)
      }
    }

    for (const line of pickHighlightSentences(selectedLatest?.rawText, selectedProduct?.displayName)) {
      const key = line.toLowerCase()
      if (normalized.has(key)) continue
      normalized.add(key)
      items.push(line)
    }

    return items.slice(0, 6)
  }, [selectedLatest, selectedProduct])

  return (
    <div id="top" className="space-y-14">
      <div>
        <Hero />
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-10 space-y-8">
        <section className="luxe-surface p-6 rounded-3xl shadow-lg space-y-6 section-reveal">
            <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-luxe text-3xl font-bold text-[#f6e8d7]">
                {t('Commodity Intelligence Dashboard', 'ವಸ್ತು ಬುದ್ಧಿವಂತಿಕೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-[#d5c4b2]">
                {t(
                  'Track today, last week, and next-week outlook per commodity with richer market notes.',
                  'ಪ್ರತಿ ವಸ್ತುವಿಗೆ ಇಂದಿನ, ಕಳೆದ ವಾರದ ಮತ್ತು ಮುಂದಿನ ವಾರದ ಪ್ರವೃತ್ತಿಯನ್ನು ಮಾರುಕಟ್ಟೆ ವಿಶ್ಲೇಷಣೆಯೊಂದಿಗೆ ನೋಡಿ.'
                )}
              </p>
            </div>
            <p className="text-xs text-[#d5c4b2]">
              {t('Last updated', 'ಕೊನೆಯ ನವೀಕರಣ')}: {lastUpdated ? new Date(lastUpdated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
            </p>
          </div>

          {latest?.runHealth?.stale && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
              <span className="font-semibold">Stale data:</span> {latest.runHealth.staleReason || 'Latest successful commodity run is not fresh.'}
            </div>
          )}

          {latest?.run?.status === 'FAILED' && (
            <div className="rounded-2xl border border-red-300/40 bg-red-950/25 px-4 py-3 text-sm text-red-100">
              <span className="font-semibold">Latest run failed:</span> {lastUpdated ? `the most recent pipeline attempt was recorded on ${new Date(lastUpdated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.` : 'the latest prices run did not complete successfully.'}
            </div>
          )}

          {(loadingProducts || loadingLatest) && (
            <div className="lux-stat rounded-xl px-4 py-3 text-sm text-[#d8e8dc]">
              {t('Loading commodity intelligence...', 'ವಸ್ತು ಮಾಹಿತಿಯನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...')}
            </div>
          )}

          {(productsError || latestError) && (
            <div className="rounded-xl border border-red-300/35 bg-red-950/25 px-4 py-3 text-sm text-red-200">
              {productsError || latestError}
            </div>
          )}

          {!loadingProducts && !loadingLatest && !productsError && !latestError && products.length === 0 && (
            <div className="rounded-xl border border-amber-300/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-200">
              {t('No enabled commodities found. Seed products in backend first.', 'ಸಕ್ರಿಯ ವಸ್ತುಗಳು ಸಿಗಲಿಲ್ಲ. ಮೊದಲು ಬ್ಯಾಕೆಂಡ್‌ನಲ್ಲಿ ಸೀಡ್ ಮಾಡಿ.')}
            </div>
          )}

          {!loadingProducts && !loadingLatest && !productsError && !latestError && products.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">Latest run status</p>
                  <p className="mt-2 text-2xl font-bold text-[#f7e9d6]">{latest?.run?.status || 'Not available'}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {latest?.run?.runAt ? new Date(latest.run.runAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No run recorded yet'}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">Last successful run</p>
                  <p className="mt-2 text-2xl font-bold text-[#f7e9d6]">{latest?.lastSuccessfulRun?.status || 'Not available'}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {latest?.lastSuccessfulRun?.runAt ? new Date(latest.lastSuccessfulRun.runAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No successful run yet'}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">Daily schedule health</p>
                  <p className="mt-2 text-2xl font-bold text-[#f7e9d6]">
                    {latest?.runHealth?.freshnessHours != null ? `${latest.runHealth.freshnessHours}h old` : 'Not available'}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {latest?.runHealth ? `${latest.runHealth.scheduleTimeLocal} ${latest.runHealth.scheduleTimezone}` : 'No schedule metadata'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map((product) => {
                  const card = latestByKey.get(product.productKey)
                  const status = card?.status || 'FAILED'

                  return (
                    <button
                      key={product.productKey}
                      type="button"
                      onClick={() => setSelectedKey(product.productKey)}
                      className={`text-left rounded-2xl border p-4 transition ${
                        selectedKey === product.productKey
                          ? 'border-emerald-500/60 bg-[#1d1a15]'
                          : 'border-[#2f3a33] bg-[#12100d]/80 hover:border-emerald-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-[#efe4d4]">{product.displayName}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          status === 'OK'
                            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-900/30'
                            : 'border-red-500/40 text-red-300 bg-red-900/30'
                        }`}>
                          {status}
                        </span>
                      </div>
                      <p className="mt-2 text-2xl font-bold text-[#f4ead9]">
                        {formatPrice(card?.currentPrice ?? card?.value)}
                      </p>
                      <p className="text-xs text-gray-400">{product.unit}</p>
                      {card?.trend && <p className="mt-1 text-xs text-emerald-300">{card.trend}</p>}
                      {card?.error && <p className="mt-1 text-xs text-red-300">{card.error}</p>}
                    </button>
                  )
                })}
              </div>

              <div className="rounded-2xl bg-[#171411]/80 border border-emerald-200/25 p-5 shadow-lg space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-2xl text-[#efe4d4]">
                      {selectedProduct?.displayName || t('Commodity Detail', 'ವಸ್ತು ವಿವರ')}
                    </h3>
                    <p className="mt-1 text-sm text-[#cbbcae]">
                      {selectedLatest?.analysisSummary || selectedLatest?.shortDescription || t('Structured intelligence updates appear here when available.', 'ಲಭ್ಯವಿರುವಾಗ ರಚಿತ ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ ಇಲ್ಲಿ ಕಾಣುತ್ತದೆ.')}
                    </p>
                  </div>
                  <div className="max-w-sm min-w-[240px]">
                    <select
                      aria-label="Select commodity"
                      className="lux-input w-full p-2.5 rounded-xl font-medium"
                      value={selectedKey}
                      onChange={(event) => setSelectedKey(event.target.value)}
                    >
                      {products.map((product) => (
                        <option key={product.productKey} value={product.productKey}>
                          {product.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">{t('Current', 'ಪ್ರಸ್ತುತ')}</p>
                    <p className="mt-2 text-3xl font-bold text-[#f7e9d6]">{formatPrice(selectedLatest?.currentPrice ?? selectedLatest?.value)}</p>
                    <p className="mt-1 text-xs text-gray-400">{selectedLatest?.unit || selectedProduct?.unit || 'INR/kg'}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">{t('Last Week', 'ಕಳೆದ ವಾರ')}</p>
                    <p className="mt-2 text-3xl font-bold text-[#f7e9d6]">{formatPrice(selectedLatest?.lastWeekPrice)}</p>
                    {selectedLatest?.lastWeekPriceMin != null && selectedLatest?.lastWeekPriceMax != null && (
                      <p className="mt-1 text-xs text-gray-400">
                        {formatPrice(selectedLatest.lastWeekPriceMin)} - {formatPrice(selectedLatest.lastWeekPriceMax)}
                      </p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">{t('Next Week', 'ಮುಂದಿನ ವಾರ')}</p>
                    <p className="mt-2 text-3xl font-bold text-[#f7e9d6]">{formatPrice(selectedLatest?.expectedNextPrice)}</p>
                    {selectedLatest?.expectedNextPriceMin != null && selectedLatest?.expectedNextPriceMax != null && (
                      <p className="mt-1 text-xs text-gray-400">
                        {formatPrice(selectedLatest.expectedNextPriceMin)} - {formatPrice(selectedLatest.expectedNextPriceMax)}
                      </p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">{t('Trend', 'ಪ್ರವೃತ್ತಿ')}</p>
                    <p className="mt-2 text-3xl font-bold text-[#f7e9d6]">{selectedLatest?.trend || '-'}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {selectedLatest?.confidence != null ? `${Math.round(selectedLatest.confidence * 100)}% confidence` : t('Partial data is handled safely.', 'ಅಪೂರ್ಣ ಮಾಹಿತಿಯೂ ಸುರಕ್ಷಿತವಾಗಿ ತೋರಿಸಲಾಗುತ್ತದೆ.')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,0.9fr] gap-5">
                  <div className="rounded-2xl border border-emerald-200/25 bg-[#14110e] p-4 space-y-4">
                    <div className="rounded-2xl border border-emerald-200/20 bg-[#100d0a] p-4 space-y-4">
                      <h4 className="text-xl font-semibold text-[#efe4d4]">Market Report</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#d6c8b9]">
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Latest Price</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{latestPriceDisplay}</p>
                        </div>
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Current INR/kg equivalent</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{currentEquivalentDisplay}</p>
                        </div>
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Last Week range/value</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{lastWeekDisplay}</p>
                        </div>
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Next Week outlook/range</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{nextWeekDisplay}</p>
                        </div>
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Trend</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{trendDisplay}</p>
                        </div>
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Confidence</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{confidenceDisplay}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-200/20 bg-[#100d0a] p-4">
                      <h4 className="text-xl font-semibold text-[#efe4d4]">Contextual Summary</h4>
                      <p className="mt-3 text-sm leading-7 text-[#d6c8b9]">
                        {selectedLatest?.analysisSummary || selectedLatest?.shortDescription || 'Not available'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-lg font-semibold text-[#efe4d4]">
                        {t('Price Curve', 'ಬೆಲೆ ವಕ್ರ')}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {dbHistoryChart ? 'Using stored historical observations with latest forecast overlay' : t('Falling back to historical observations', 'ಇತಿಹಾಸ ಆಬ್ಸರ್ವೇಶನ್‌ಗಳಿಗೆ ಹಿಂತಿರುಗುತ್ತಿದೆ')}
                      </p>
                    </div>

                    {loadingHistory && !dbHistoryChart && (
                      <p className="text-sm text-[#d8e8dc]">{t('Loading history...', 'ಇತಿಹಾಸ ಲೋಡ್ ಆಗುತ್ತಿದೆ...')}</p>
                    )}

                    {historyError && !dbHistoryChart && (
                      <p className="text-sm text-red-300">{historyError}</p>
                    )}

                    {!chartConfig && !loadingHistory && (
                      <p className="text-sm text-gray-400">
                        {t('No chartable points available for this commodity yet.', 'ಈ ವಸ್ತುವಿಗೆ ಇನ್ನೂ ಚಾರ್ಟ್ ಮಾಡಬಹುದಾದ ಪಾಯಿಂಟ್‌ಗಳು ಲಭ್ಯವಿಲ್ಲ.')}
                      </p>
                    )}

                    {chartConfig && (
                      <Line
                        data={{
                          labels: chartConfig.labels,
                          datasets: dbHistoryChart
                            ? [
                                {
                                  label: 'Historical DB observations',
                                  data: dbHistoryChart.historicalSeries,
                                  borderColor: 'rgb(16,185,129)',
                                  backgroundColor: 'rgba(16,185,129,0.2)',
                                  tension: 0.25,
                                },
                                {
                                  label: t('Forecast', 'ಅಂದಾಜು'),
                                  data: dbHistoryChart.forecastSeries,
                                  borderColor: 'rgb(245,158,11)',
                                  backgroundColor: 'rgba(245,158,11,0.2)',
                                  tension: 0.25,
                                  borderDash: [6, 4],
                                },
                              ]
                            : [
                                {
                                  label: `${selectedProduct?.displayName || 'Price'} (${selectedProduct?.unit || 'INR/kg'})`,
                                  data: fallbackHistoryChart?.series || [],
                                  borderColor: 'rgb(16,185,129)',
                                  backgroundColor: 'rgba(16,185,129,0.2)',
                                  tension: 0.3,
                                },
                              ],
                        }}
                        options={{ responsive: true, plugins: { legend: { position: 'top' } } }}
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-200/25 bg-[#14110e] p-4">
                      <h4 className="text-lg font-semibold text-[#efe4d4]">{t('Analysis', 'ವಿಶ್ಲೇಷಣೆ')}</h4>
                      <p className="mt-3 text-sm leading-6 text-[#d6c8b9]">
                        {selectedLatest?.analysisSummary || selectedLatest?.shortDescription || t('No analysis summary is available yet. The dashboard will keep rendering partial results safely.', 'ವಿಶ್ಲೇಷಣೆಯ ಸಾರಾಂಶ ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ. ಭಾಗಶಃ ಫಲಿತಾಂಶಗಳೂ ಸುರಕ್ಷಿತವಾಗಿ ತೋರಿಸಲಾಗುತ್ತವೆ.')}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200/25 bg-[#14110e] p-4">
                      <h4 className="text-lg font-semibold text-[#efe4d4]">{t('Highlights', 'ಮುಖ್ಯಾಂಶಗಳು')}</h4>
                      <div className="mt-3 space-y-2">
                        {derivedHighlights.length > 0 ? (
                          derivedHighlights.map((bullet, index) => (
                            <div key={`${bullet}-${index}`} className="rounded-xl bg-[#100d0a] px-3 py-2 text-sm leading-6 text-[#d6c8b9]">
                              {bullet}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400">
                            {t('No structured highlights available yet.', 'ರಚಿತ ಮುಖ್ಯಾಂಶಗಳು ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ.')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-200/25 bg-[#14110e] p-4">
                      <h4 className="text-lg font-semibold text-[#efe4d4]">{t('Sources', 'ಮೂಲಗಳು')}</h4>
                      <div className="mt-3 space-y-2">
                        {(selectedLatest?.sources || []).length > 0 ? (
                          (selectedLatest?.sources || []).map((source, index) => (
                            <a
                              key={`${source.url}-${index}`}
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-xl bg-[#100d0a] px-3 py-2 text-sm text-[#d6c8b9] hover:bg-[#17120d]"
                            >
                              <div className="font-medium text-[#efe4d4]">{source.title || source.host || source.url}</div>
                              <div className="text-xs text-gray-400">{source.host || source.url}</div>
                            </a>
                          ))
                        ) : selectedLatest?.sourceUrl ? (
                          <a
                            href={selectedLatest.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-xl bg-[#100d0a] px-3 py-2 text-sm text-[#d6c8b9] hover:bg-[#17120d]"
                          >
                            {selectedLatest.sourceUrl}
                          </a>
                        ) : (
                          <p className="text-sm text-gray-400">
                            {t('No source links captured for this commodity yet.', 'ಈ ವಸ್ತುವಿಗೆ ಇನ್ನೂ ಮೂಲ ಲಿಂಕ್‌ಗಳು ಲಭ್ಯವಿಲ್ಲ.')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-200/25 bg-[#14110e] p-4">
                      <h4 className="text-lg font-semibold text-[#efe4d4]">Recent Daily History</h4>
                      <div className="mt-3 space-y-2">
                        {recentDailyHistory.length > 0 ? (
                          recentDailyHistory.map((point) => (
                            <div key={`${point.runId}-${point.capturedAt}`} className="rounded-xl bg-[#100d0a] px-3 py-3 text-sm text-[#d6c8b9]">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium text-[#efe4d4]">
                                  {new Date(point.capturedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                </span>
                                <span className={`text-xs ${point.status === 'OK' ? 'text-emerald-300' : 'text-red-300'}`}>
                                  {point.runStatus} / {point.status}
                                </span>
                              </div>
                              <div className="mt-1 text-[#efe4d4]">
                                {point.value != null ? `${formatPrice(point.value)} ${point.unit}` : 'No usable price captured'}
                              </div>
                              <div className="mt-1 text-xs text-gray-400">
                                {point.error || point.source || 'Historical observation stored successfully.'}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-400">No recent daily observations stored for this commodity yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {!hasRichDetail && selectedLatest?.error && (
                  <div className="rounded-xl border border-red-300/35 bg-red-950/25 px-4 py-3 text-sm text-red-200">
                    {selectedLatest.error}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <Footer />
    </div>
  )
}
