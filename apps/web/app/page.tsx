'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
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

type RangeParts = {
  large: string
  small: string
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

type PipelineRunStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'FAILED'
  | 'RUNNING'
  | 'LIVE'
  | 'VERIFIED'
  | 'AVAILABLE'
  | 'DEGRADED'
  | null
  | undefined

function formatPrice(value: number | null | undefined) {
  return value != null ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'
}

function formatTimeAgo(value: string | null | undefined) {
  if (!value) return 'Not available'

  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  if (Number.isNaN(date.getTime()) || diffMs < 0) return 'Just now'

  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  if (diffMinutes <= 0) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getStatusTone(status: PipelineRunStatus) {
  switch (status) {
    case 'LIVE':
    case 'VERIFIED':
    case 'AVAILABLE':
    case 'SUCCESS':
      return {
        dot: 'bg-emerald-400',
        text: 'text-emerald-200',
        border: 'border-emerald-400/20 hover:border-emerald-400/35',
        glow: 'shadow-[0_0_30px_rgba(16,185,129,0.08)]',
      }
    case 'DEGRADED':
    case 'PARTIAL':
    case 'RUNNING':
      return {
        dot: 'bg-amber-400',
        text: 'text-amber-200',
        border: 'border-amber-400/20 hover:border-amber-400/35',
        glow: 'shadow-[0_0_30px_rgba(245,158,11,0.08)]',
      }
    case 'FAILED':
      return {
        dot: 'bg-red-400',
        text: 'text-red-200',
        border: 'border-red-400/20 hover:border-red-400/35',
        glow: 'shadow-[0_0_30px_rgba(248,113,113,0.08)]',
      }
    default:
      return {
        dot: 'bg-slate-400',
        text: 'text-[#efe4d4]',
        border: 'border-white/10 hover:border-white/20',
        glow: 'shadow-[0_0_24px_rgba(255,255,255,0.04)]',
      }
  }
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M3 12h4l2.5-5 5 10 2.5-5H21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StatusIndicator({ status }: { status: PipelineRunStatus }) {
  const tone = getStatusTone(status)

  return (
    <div className={`inline-flex items-center gap-2 ${tone.text}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${tone.dot} animate-pulse`} />
      <span className="text-2xl font-semibold tracking-tight text-[#f7e9d6]">{status || 'Not available'}</span>
    </div>
  )
}

function PipelineStatusCard({
  title,
  status,
  timestamp,
  subtitle,
  icon,
  freshnessWarning = false,
}: {
  title: string
  status: string
  timestamp: string | null | undefined
  subtitle: string
  icon: ReactNode
  freshnessWarning?: boolean
}) {
  const tone = getStatusTone(status as PipelineRunStatus)
  const timestampText = timestamp
    ? new Date(timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not available'
  const timeAgo = formatTimeAgo(timestamp)

  return (
    <div
      className={`rounded-xl border ${tone.border} ${tone.glow} bg-black/40 backdrop-blur p-5 transition duration-300 hover:-translate-y-0.5`}
    >
      <div className="flex items-center gap-3 text-[#d5c4b2]">
        <div className="rounded-lg border border-white/10 bg-white/5 p-2">{icon}</div>
        <p className="text-xs uppercase tracking-[0.28em] text-[#9fb8a2]">{title}</p>
      </div>

      <div className="mt-5 space-y-2 transition duration-300 ease-out">
        <StatusIndicator status={status as PipelineRunStatus} />
        <p className="text-sm text-[#d5c4b2]">{timestampText}</p>
        <p className={`text-xs ${freshnessWarning ? 'text-amber-300' : 'text-gray-400'}`}>
          Updated {timeAgo}
        </p>
        <p className="pt-1 text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  )
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
    return `${formatPrice(min)}–${formatPrice(max)}`
  }
  if (value != null) {
    return formatPrice(value)
  }
  return 'Not available'
}

function formatRangeOrValueParts(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined
): RangeParts {
  const large = formatRangeOrValue(value, min, max)

  if (min != null && max != null && min !== max) {
    return {
      large,
      small: 'Observed market range',
    }
  }

  if (value != null) {
    return {
      large,
      small: 'Single observed value',
    }
  }

  return {
    large: 'Not available',
    small: 'No parsed value available',
  }
}

function isCoffeeCommodity(product: Pick<PriceProduct, 'productKey' | 'displayName'> | null | undefined) {
  const marker = `${product?.productKey || ''} ${product?.displayName || ''}`.toLowerCase()
  return /(arabica|robusta)/.test(marker)
}

function isCoffeeBoardSource(card: Pick<PriceLatestCard, 'source' | 'metadata'> | null | undefined) {
  const source = (card?.source || '').trim().toLowerCase()
  const reportSourceLabel = getMetadataString(card?.metadata, 'reportSourceLabel')?.toLowerCase()
  return source === 'coffee board india' || reportSourceLabel === 'coffee board india'
}

function formatPer50KgEquivalent(value: number | null | undefined) {
  if (value == null) return 'Not available'
  return `≈ ${formatPrice(value * 50)} per 50 kg`
}

function formatPrimaryCoffeePrice(value: number | null | undefined) {
  if (value == null) return 'Not available'
  return `${formatPrice(value * 50)} per 50 kg`
}

function formatMidpointPerKg(value: number | null | undefined) {
  if (value == null) return 'Not available'
  return `≈ ${formatPrice(value)} / kg midpoint`
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function getMetadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string) {
  return typeof metadata?.[key] === 'boolean' ? metadata[key] as boolean : null
}

function formatSignalParts(
  numeric: RangeParts,
  signal: string | null | undefined,
  kind: 'last_week' | 'next_week'
): RangeParts {
  if (numeric.large !== 'Not available') return numeric
  if (signal) {
    return {
      large: signal,
      small: kind === 'last_week' ? 'Derived market comparison' : 'Derived market outlook',
    }
  }
  return {
    large: 'No reliable signal',
    small: kind === 'last_week' ? 'No last-week signal available' : 'No next-week signal available',
  }
}

function buildMarketHorizonChart(
  historyPoints: PriceHistoryPoint[] | undefined,
  forecastPoints: InsightPoint[] | undefined,
  expectedNextPrice: number | null | undefined
) {
  const labels = ['2d ago', '1d ago', 'Today', '+1d', '+2d']
  const historicalSeries = [null, null, null, null, null] as Array<number | null>
  const forecastSeries = [null, null, null, null, null] as Array<number | null>

  const recentHistory = [...(historyPoints || [])]
    .filter((point) => point.value != null)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
    .slice(-3)

  if (recentHistory.length === 1) {
    historicalSeries[2] = recentHistory[0].value
  } else if (recentHistory.length === 2) {
    historicalSeries[1] = recentHistory[0].value
    historicalSeries[2] = recentHistory[1].value
  } else if (recentHistory.length >= 3) {
    historicalSeries[0] = recentHistory[0].value
    historicalSeries[1] = recentHistory[1].value
    historicalSeries[2] = recentHistory[2].value
  }

  const futurePoints = (forecastPoints || []).filter((point) => point.value != null).slice(0, 2)
  if (futurePoints[0]?.value != null) forecastSeries[3] = futurePoints[0].value
  if (futurePoints[1]?.value != null) forecastSeries[4] = futurePoints[1].value
  if (forecastSeries[3] == null && forecastSeries[4] == null && expectedNextPrice != null) {
    forecastSeries[4] = expectedNextPrice
  }

  if (!historicalSeries.some((value) => value != null) && !forecastSeries.some((value) => value != null)) {
    return null
  }

  return {
    labels,
    historicalSeries,
    forecastSeries,
  }
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

const INSIGHT_NOISE_PATTERNS = [
  /latest price today in madikeri/i,
  /show me the latest prices analysis/i,
  /skip to content/i,
  /read more/i,
  /about\s+\d+\s+results?/i,
  /\bprivacy\b/i,
  /\bterms\b/i,
  /all search images videos maps news copilot/i,
  /\bview all\b/i,
]

function cleanHighlightLine(line: string) {
  return line.replace(/\s+/g, ' ').trim()
}

function canonicalizeInsightLine(line: string) {
  return cleanHighlightLine(line)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9₹ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeInsightText(value: string | null | undefined) {
  const cleaned = cleanHighlightLine(value || '')
  if (!cleaned) return ''
  if (INSIGHT_NOISE_PATTERNS.some((pattern) => pattern.test(cleaned))) return ''
  if (/^https?:\/\//i.test(cleaned)) return ''
  if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(cleaned)) return ''
  if (/^[A-Z0-9\s|:.-]{18,}$/.test(cleaned)) return ''

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  const deduped: string[] = []
  const seen = new Set<string>()
  for (const sentence of sentences) {
    if (INSIGHT_NOISE_PATTERNS.some((pattern) => pattern.test(sentence))) continue
    const key = canonicalizeInsightLine(sentence)
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(sentence)
  }

  return deduped.join(' ').trim()
}

function isUsefulHighlightLine(line: string) {
  const cleaned = sanitizeInsightText(line)
  if (!cleaned || cleaned.length < 24 || cleaned.length > 220) return false
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
    .map(sanitizeInsightText)
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

        const visibleProducts = productsPayload.products.filter((product) => isCoffeeCommodity(product))
        if (visibleProducts.length > 0) {
          setSelectedKey((current) => current || visibleProducts[0].productKey)
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

  const visibleProducts = useMemo(
    () => products.filter((product) => isCoffeeCommodity(product)),
    [products]
  )

  useEffect(() => {
    if (visibleProducts.length === 0) return
    if (!visibleProducts.some((product) => product.productKey === selectedKey)) {
      setSelectedKey(visibleProducts[0].productKey)
    }
  }, [visibleProducts, selectedKey])

  const selectedProduct = useMemo(
    () => visibleProducts.find((product) => product.productKey === selectedKey) || visibleProducts[0] || null,
    [visibleProducts, selectedKey]
  )

  const activeSelectedKey = selectedProduct?.productKey || ''

  useEffect(() => {
    if (!activeSelectedKey) {
      setHistory(null)
      return
    }

    let mounted = true
    async function loadHistory() {
      setLoadingHistory(true)
      setHistoryError(null)
      try {
        const res = await fetch(`/api/prices/history?days=30&productKey=${encodeURIComponent(activeSelectedKey)}`, {
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
  }, [activeSelectedKey])

  const latestByKey = useMemo(() => {
    const map = new Map<string, PriceLatestCard>()
    for (const row of latest?.products || []) {
      map.set(row.productKey, row)
    }
    return map
  }, [latest])

  const selectedLatest = useMemo(
    () => latestByKey.get(activeSelectedKey) || null,
    [latestByKey, activeSelectedKey]
  )
  const selectedCoffeeBoardLatest = isCoffeeCommodity(selectedProduct) && !isCoffeeBoardSource(selectedLatest)
    ? null
    : selectedLatest
  const coffeeCards = useMemo(
    () => visibleProducts.map((product) => latestByKey.get(product.productKey)).filter(Boolean) as PriceLatestCard[],
    [visibleProducts, latestByKey]
  )

  const dbHistoryChart = useMemo(
    () => buildMarketHorizonChart(history?.daily || history?.history, selectedLatest?.forecastPoints, selectedLatest?.expectedNextPrice),
    [history, selectedLatest]
  )

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
    selectedCoffeeBoardLatest?.todayPrice ?? selectedCoffeeBoardLatest?.currentPrice ?? selectedCoffeeBoardLatest?.value,
    selectedCoffeeBoardLatest?.todayPriceMin,
    selectedCoffeeBoardLatest?.todayPriceMax
  )
  const currentKgDisplay = selectedCoffeeBoardLatest?.currentPrice != null || selectedCoffeeBoardLatest?.value != null
    ? `${formatPrice(selectedCoffeeBoardLatest?.currentPrice ?? selectedCoffeeBoardLatest?.value)} ${selectedCoffeeBoardLatest?.unit || selectedProduct?.unit || 'INR/kg'}`
    : 'Not available'
  const lastWeekDisplay = formatRangeOrValue(
    selectedCoffeeBoardLatest?.lastWeekPrice,
    selectedCoffeeBoardLatest?.lastWeekPriceMin,
    selectedCoffeeBoardLatest?.lastWeekPriceMax
  )
  const nextWeekDisplay = formatRangeOrValue(
    selectedCoffeeBoardLatest?.expectedNextPrice,
    selectedCoffeeBoardLatest?.expectedNextPriceMin,
    selectedCoffeeBoardLatest?.expectedNextPriceMax
  )
  const trendDisplay = formatValueOrNotAvailable(selectedCoffeeBoardLatest?.trend)
  const confidenceDisplay =
    selectedCoffeeBoardLatest?.confidence != null ? `${Math.round(selectedCoffeeBoardLatest.confidence * 100)}%` : 'Not available'
  const scheduleFreshnessWarning = (latest?.runHealth?.freshnessHours ?? 0) > 24
  const currentPer50KgDisplay = isCoffeeCommodity(selectedProduct)
    ? formatPer50KgEquivalent(selectedCoffeeBoardLatest?.currentPrice ?? selectedCoffeeBoardLatest?.value)
    : null
  const currentPrimaryDisplay = isCoffeeCommodity(selectedProduct)
    ? formatPrimaryCoffeePrice(selectedCoffeeBoardLatest?.currentPrice ?? selectedCoffeeBoardLatest?.value)
    : formatPrice(selectedCoffeeBoardLatest?.currentPrice ?? selectedCoffeeBoardLatest?.value)
  const currentSecondaryDisplay = isCoffeeCommodity(selectedProduct)
    ? `(${currentKgDisplay.replace(/^/, '≈ ')})`
    : (selectedCoffeeBoardLatest?.unit || selectedProduct?.unit || 'INR/kg')
  const lastWeekParts = formatRangeOrValueParts(
    selectedCoffeeBoardLatest?.lastWeekPrice,
    selectedCoffeeBoardLatest?.lastWeekPriceMin,
    selectedCoffeeBoardLatest?.lastWeekPriceMax
  )
  const nextWeekParts = formatRangeOrValueParts(
    selectedCoffeeBoardLatest?.expectedNextPrice,
    selectedCoffeeBoardLatest?.expectedNextPriceMin,
    selectedCoffeeBoardLatest?.expectedNextPriceMax
  )
  const lastWeekSignal = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'last_week_display_signal')
  const nextWeekSignal = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'next_week_display_signal')
  const sentimentDisplay = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'marketSentiment') || 'Stable'
  const lastWeekDisplayParts = formatSignalParts(lastWeekParts, lastWeekSignal, 'last_week')
  const nextWeekDisplayParts = formatSignalParts(nextWeekParts, nextWeekSignal, 'next_week')
  const recentDailyHistory = useMemo(
    () => [...(history?.daily || [])].reverse().slice(0, 7),
    [history]
  )
  const contextualSummary = useMemo(() => {
    return (
      sanitizeInsightText(selectedLatest?.shortDescription) ||
      sanitizeInsightText(selectedCoffeeBoardLatest?.analysisSummary) ||
      'No reliable structured market summary available.'
    )
  }, [selectedCoffeeBoardLatest, selectedLatest])
  const analysisText = useMemo(() => {
    return (
      sanitizeInsightText(selectedCoffeeBoardLatest?.analysisSummary) ||
      sanitizeInsightText(selectedCoffeeBoardLatest?.shortDescription) ||
      'No reliable structured market summary available.'
    )
  }, [selectedCoffeeBoardLatest])
  const derivedHighlights = useMemo(() => {
    const normalized = new Set<string>()
    const items: string[] = []

    for (const bullet of selectedCoffeeBoardLatest?.analysisBullets || []) {
      const cleaned = sanitizeInsightText(bullet)
      if (!isUsefulHighlightLine(cleaned)) continue
      const key = canonicalizeInsightLine(cleaned)
      if (normalized.has(key)) continue
      normalized.add(key)
      items.push(cleaned)
    }

    const summary = sanitizeInsightText(selectedCoffeeBoardLatest?.shortDescription || selectedCoffeeBoardLatest?.analysisSummary || '')
    if (isUsefulHighlightLine(summary)) {
      const key = canonicalizeInsightLine(summary)
      if (!normalized.has(key)) {
        normalized.add(key)
        items.push(summary)
      }
    }

    if (items.length === 0) {
      for (const line of pickHighlightSentences(selectedCoffeeBoardLatest?.rawText, selectedProduct?.displayName)) {
        const cleaned = sanitizeInsightText(line)
        if (!isUsefulHighlightLine(cleaned)) continue
        const key = canonicalizeInsightLine(cleaned)
        if (normalized.has(key)) continue
        normalized.add(key)
        items.push(cleaned)
      }
    }

    return items.slice(0, 4)
  }, [selectedCoffeeBoardLatest, selectedProduct])
  const reportTitle = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'reportTitle') || selectedCoffeeBoardLatest?.source || 'Coffee Board India'
  const reportDate = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'reportDate')
  const reportSourceUrl = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'reportSourceUrl') || selectedCoffeeBoardLatest?.sourceUrl
  const reportFileName = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'reportFileName')
  const reportRangeOriginal = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'currentRangeOriginal')
  const reportRangeNormalized = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'currentRangeInrPerKg')
  const reportAnalysis = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'marketAnalysis')
  const reportStatus = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'reportStatus')
  const lastCheckedAt = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'lastCheckedAt')
  const latestSuccessfulReportDate = getMetadataString(selectedLatest?.metadata, 'latestSuccessfulReportDate') || reportDate
  const reportStatusBadge = reportStatus === 'NEW_REPORT'
    ? 'LIVE REPORT'
    : reportStatus === 'FETCH_FAILED'
      ? 'COFFEE BOARD UNAVAILABLE'
      : !selectedCoffeeBoardLatest && isCoffeeCommodity(selectedProduct)
        ? 'COFFEE BOARD DATA REQUIRED'
        : 'REPORT STATUS UNKNOWN'
  const reportStatusMessage = reportStatus === 'FETCH_FAILED'
    ? 'Coffee Board could not be refreshed right now. Coffee prices are unavailable until the PDF is fetched again.'
    : reportStatus === 'NEW_REPORT'
      ? 'Live Coffee Board report loaded.'
      : !selectedCoffeeBoardLatest && isCoffeeCommodity(selectedProduct)
        ? 'Coffee prices are unavailable because no valid Coffee Board PDF data is present in the latest run.'
      : null
  const coffeeAvailableCount = visibleProducts.filter((product) => {
    const card = latestByKey.get(product.productKey)
    return Boolean(card && isCoffeeBoardSource(card) && (card.currentPrice != null || card.value != null))
  }).length
  const coffeeDashboardStatus = visibleProducts.length > 0 && coffeeAvailableCount === visibleProducts.length
    ? (coffeeCards.some((card) => isCoffeeBoardSource(card) && getMetadataString(card.metadata, 'reportStatus') === 'NEW_REPORT') ? 'LIVE' : 'VERIFIED')
    : coffeeAvailableCount > 0
      ? 'DEGRADED'
      : 'FAILED'
  const coffeeSummarySubtitle = `${coffeeAvailableCount}/${visibleProducts.length || 4} coffee commodities available`
  const coffeeMidpointDisplay = formatMidpointPerKg(selectedCoffeeBoardLatest?.currentPrice ?? selectedCoffeeBoardLatest?.value)
  const currentCoffeePrimaryDisplay = reportRangeOriginal || currentPrimaryDisplay
  const currentCoffeeSecondaryDisplay = reportRangeNormalized || currentSecondaryDisplay

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

          {!loadingProducts && !loadingLatest && !productsError && !latestError && visibleProducts.length === 0 && (
            <div className="rounded-xl border border-amber-300/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-200">
              {t('No enabled coffee commodities found. Seed products in backend first.', 'ಸಕ್ರಿಯ ಕಾಫಿ ವಸ್ತುಗಳು ಸಿಗಲಿಲ್ಲ. ಮೊದಲು ಬ್ಯಾಕೆಂಡ್‌ನಲ್ಲಿ ಸೀಡ್ ಮಾಡಿ.')}
            </div>
          )}

          {!loadingProducts && !loadingLatest && !productsError && !latestError && visibleProducts.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <PipelineStatusCard
                  title="Coffee Dashboard Status"
                  status={coffeeDashboardStatus}
                  timestamp={lastCheckedAt || latest?.run?.runAt}
                  subtitle={coffeeSummarySubtitle}
                  icon={<ActivityIcon />}
                />
                <PipelineStatusCard
                  title="Latest Coffee Board Report"
                  status={reportStatus === 'NEW_REPORT' ? 'LIVE' : coffeeDashboardStatus}
                  timestamp={reportDate || latestSuccessfulReportDate || latest?.lastSuccessfulRun?.runAt}
                  subtitle={reportStatusMessage || 'Latest verified Coffee Board snapshot is available.'}
                  icon={<CheckCircleIcon />}
                />
                <PipelineStatusCard
                  title="Daily Coffee Check"
                  status={
                    latest?.runHealth?.freshnessHours == null
                      ? 'Not available'
                      : scheduleFreshnessWarning
                        ? 'FAILED'
                        : coffeeDashboardStatus
                  }
                  timestamp={lastCheckedAt || latest?.runHealth?.latestRunAt || latest?.runHealth?.lastSuccessfulRunAt}
                  subtitle={
                    latest?.runHealth
                      ? `${latest.runHealth.scheduleTimeLocal} ${latest.runHealth.scheduleTimezone} • freshness window ${latest.runHealth.maxFreshnessHours}h`
                      : 'No schedule metadata'
                  }
                  icon={<ClockIcon />}
                  freshnessWarning={scheduleFreshnessWarning}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleProducts.map((product) => {
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
                        {isCoffeeCommodity(product)
                          ? (getMetadataString(card?.metadata, 'currentRangeOriginal') || formatPrimaryCoffeePrice(card?.currentPrice ?? card?.value))
                          : formatPrice(card?.currentPrice ?? card?.value)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {isCoffeeCommodity(product)
                          ? (getMetadataString(card?.metadata, 'currentRangeInrPerKg') || (card?.currentPrice != null || card?.value != null ? `≈ ${formatPrice((card?.currentPrice ?? card?.value ?? 0))}/kg` : 'Not available'))
                          : product.unit}
                      </p>
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
                      {contextualSummary || t('Structured intelligence updates appear here when available.', 'ಲಭ್ಯವಿರುವಾಗ ರಚಿತ ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ ಇಲ್ಲಿ ಕಾಣುತ್ತದೆ.')}
                    </p>
                  </div>
                  <div className="max-w-sm min-w-[240px]">
                    <select
                      aria-label="Select commodity"
                      className="lux-input w-full p-2.5 rounded-xl font-medium"
                      value={activeSelectedKey}
                      onChange={(event) => setSelectedKey(event.target.value)}
                    >
                      {visibleProducts.map((product) => (
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
                    <p className="mt-2 text-3xl font-bold text-[#f7e9d6]">{currentCoffeePrimaryDisplay}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {currentCoffeeSecondaryDisplay}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">Midpoint</p>
                    <p className="mt-2 text-3xl font-bold text-[#f7e9d6]">{coffeeMidpointDisplay}</p>
                    <p className="mt-1 text-xs text-gray-400">Used for continuity in charts and history</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">Report Status</p>
                    <p className="mt-2 text-2xl font-bold text-[#f7e9d6]">{reportStatusBadge}</p>
                    <p className="mt-1 text-xs text-gray-400">{reportStatusMessage || 'Coffee Board values are in sync with the latest verified report.'}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">{t('Trend', 'ಪ್ರವೃತ್ತಿ')}</p>
                    <p className="mt-2 text-3xl font-bold text-[#f7e9d6]">{selectedLatest?.trend || '-'}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {selectedLatest?.confidence != null ? `${Math.round(selectedLatest.confidence * 100)}% confidence` : t('Partial data is handled safely.', 'ಅಪೂರ್ಣ ಮಾಹಿತಿಯೂ ಸುರಕ್ಷಿತವಾಗಿ ತೋರಿಸಲಾಗುತ್ತದೆ.')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">Daily Coffee Report</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <p className="text-xl font-semibold text-[#f7e9d6]">{reportTitle}</p>
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-950/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                        {reportStatusBadge}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#d5c4b2]">{reportDate || 'Report date not available'}</p>
                    {reportFileName && <p className="mt-1 text-xs text-gray-400">{reportFileName}</p>}
                    {reportStatusMessage && (
                      <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
                        {reportStatusMessage}
                      </p>
                    )}
                    {lastCheckedAt && (
                      <p className="mt-2 text-xs text-gray-500">Last checked: {formatDateTime(lastCheckedAt)}</p>
                    )}
                    {reportSourceUrl && (
                      <a
                        href={reportSourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-sm text-emerald-300 hover:text-emerald-200"
                      >
                        Open source report
                      </a>
                    )}
                  </div>
                  <div className="rounded-2xl border border-emerald-200/20 bg-[#110f0d] p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-[#9fb8a2]">Exact Coffee Board Range</p>
                    <p className="mt-3 text-2xl font-bold text-[#f7e9d6]">{reportRangeOriginal || 'Not available'}</p>
                    <p className="mt-2 text-sm text-gray-400">{reportRangeNormalized || 'Normalized INR/kg not available'}</p>
                    <p className="mt-2 text-xs text-emerald-300">{coffeeMidpointDisplay}</p>
                    <p className="mt-3 text-sm text-[#d5c4b2]">{reportAnalysis || analysisText}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,0.9fr] gap-5">
                  <div className="rounded-2xl border border-emerald-200/25 bg-[#14110e] p-4 space-y-4">
                    <div className="rounded-2xl border border-emerald-200/20 bg-[#100d0a] p-4 space-y-4">
                      <h4 className="text-xl font-semibold text-[#efe4d4]">Market Report</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#d6c8b9]">
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Latest Price</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{isCoffeeCommodity(selectedProduct) ? currentPrimaryDisplay : latestPriceDisplay}</p>
                        </div>
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">{isCoffeeCommodity(selectedProduct) ? 'Normalized INR/kg' : 'Current INR/kg equivalent'}</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{currentKgDisplay}</p>
                          {currentPer50KgDisplay && <p className="mt-1 text-xs text-gray-400">{currentPer50KgDisplay}</p>}
                        </div>
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Last Week range/value</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{lastWeekDisplayParts.large}</p>
                          <p className="mt-1 text-xs text-gray-400">{lastWeekDisplayParts.small}</p>
                        </div>
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Next Week outlook/range</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{nextWeekDisplayParts.large}</p>
                          <p className="mt-1 text-xs text-gray-400">{nextWeekDisplayParts.small}</p>
                        </div>
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Trend</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{trendDisplay}</p>
                        </div>
                        <div className="rounded-xl bg-[#171411] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-[#9fb8a2]">Market Sentiment</p>
                          <p className="mt-2 text-lg font-semibold text-[#f7e9d6]">{sentimentDisplay}</p>
                          <p className="mt-1 text-xs text-gray-400">{confidenceDisplay} confidence</p>
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
                        {contextualSummary || 'No reliable structured market summary available.'}
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
                        {analysisText || t('No analysis summary is available yet. The dashboard will keep rendering partial results safely.', 'ವಿಶ್ಲೇಷಣೆಯ ಸಾರಾಂಶ ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ. ಭಾಗಶಃ ಫಲಿತಾಂಶಗಳೂ ಸುರಕ್ಷಿತವಾಗಿ ತೋರಿಸಲಾಗುತ್ತವೆ.')}
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
