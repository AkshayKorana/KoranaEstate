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
import { useEffectiveTheme } from './theme-context'

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

const DEFAULT_COFFEE_PRODUCTS: PriceProduct[] = [
  {
    productKey: 'arabica_cherry',
    displayName: 'Arabica Cherry',
    unit: 'INR/kg',
    defaultSource: 'Coffee Board India',
    sourceUrl: 'https://coffeeboard.gov.in/Market_Info.aspx',
    displayOrder: 1,
    enabled: true,
  },
  {
    productKey: 'arabica_parchment',
    displayName: 'Arabica Parchment',
    unit: 'INR/kg',
    defaultSource: 'Coffee Board India',
    sourceUrl: 'https://coffeeboard.gov.in/Market_Info.aspx',
    displayOrder: 2,
    enabled: true,
  },
  {
    productKey: 'robusta_cherry',
    displayName: 'Robusta Cherry',
    unit: 'INR/kg',
    defaultSource: 'Coffee Board India',
    sourceUrl: 'https://coffeeboard.gov.in/Market_Info.aspx',
    displayOrder: 3,
    enabled: true,
  },
  {
    productKey: 'robusta_parchment',
    displayName: 'Robusta Parchment',
    unit: 'INR/kg',
    defaultSource: 'Coffee Board India',
    sourceUrl: 'https://coffeeboard.gov.in/Market_Info.aspx',
    displayOrder: 4,
    enabled: true,
  },
]

const LAST_KNOWN_PRICES_KEY = 'korana:last-known-prices'
// Always use the Next.js proxy — avoids CORS and browser-side cold-start timeouts
const DIRECT_PRICES_LATEST_URL = '/api/prices/latest'

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

// ── PDF parsing helpers ────────────────────────────────────────────────────────
function parsePdfMarketAnalysis(rawText: string | null | undefined): string | null {
  if (!rawText) return null
  const m = rawText.match(/Market Analysis\s*\n+([\s\S]+?)(?=\n\s*(?:Differentials|ICTA|Export|Raw Coffee|$))/i)
  if (!m) return null
  return m[1].replace(/\s+/g, ' ').trim().slice(0, 800) || null
}

type IceFuturesRow = { month: string; arabicaCentsLb: number; arabicaRsKg: number; robustaUsdTonne: number; robustaRsKg: number }
function parsePdfIceFutures(rawText: string | null | undefined): IceFuturesRow[] {
  if (!rawText) return []
  const rows: IceFuturesRow[] = []
  const re = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[-–]\s*\d{4})\s+([\d.]+)\s+([\d.]+)\s+(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[-–]\s*\d{4})\s+([\d,]+)\s+([\d.]+)\s+([\d.]+)/gi
  for (const m of rawText.matchAll(re)) {
    rows.push({
      month: m[1].replace(/\s+/g, ' ').trim(),
      arabicaCentsLb: parseFloat(m[2]),
      arabicaRsKg: parseFloat(m[3]),
      robustaUsdTonne: parseFloat(m[4].replace(/,/g, '')),
      robustaRsKg: parseFloat(m[6]),
    })
    if (rows.length >= 3) break
  }
  return rows
}

type IcoIndicator = { arabicaCents: number; arabicaPrev: number; arabicaRs: number; robustaCents: number; robustaPrev: number; robustaRs: number; exchangeRate: number | null }
function parsePdfIcoIndicator(rawText: string | null | undefined): IcoIndicator | null {
  if (!rawText) return null
  const ex = rawText.match(/Exchange Rate\s+Rs\s*\/\s*US\s*\$\s*([\d.]+)/i)
  const m = rawText.match(/([\d.]+)\s*\(\s*([\d.]+)\s*\)\s+([\d.]+)\s*\([\d.]+\s*\)\s+([\d.]+)\s*\(\s*([\d.]+)\s*\)\s+([\d.]+)/)
  if (!m) return null
  return {
    arabicaCents: parseFloat(m[1]),
    arabicaPrev: parseFloat(m[2]),
    arabicaRs: parseFloat(m[3]),
    robustaCents: parseFloat(m[4]),
    robustaPrev: parseFloat(m[5]),
    robustaRs: parseFloat(m[6]),
    exchangeRate: ex ? parseFloat(ex[1]) : null,
  }
}

type IctaRow = { grade: string; value: number }
type IctaAuctionData = { date: string | null; arabicaPlantation: IctaRow[]; arabicaCherry: IctaRow[]; robustaParchment: IctaRow[]; robustaCherry: IctaRow[] }
function parsePdfIcta(rawText: string | null | undefined): IctaAuctionData | null {
  if (!rawText) return null
  const dateM = rawText.match(/ICTA Auction Prices.*?as on\s+([\d.]+)/i)
  const parseRow = (label: string): IctaRow[] => {
    const m = rawText.match(new RegExp(label + '\\s*\\([^)]+\\)\\s*([\\d.\\s-]+)', 'i'))
    if (!m) return []
    const grades = ['MNEB','AA','PB','A','AB','B','C','BBB','AAA']
    return m[1].trim().split(/\s+/).map((v, i) => ({ grade: grades[i] || `G${i}`, value: parseFloat(v) })).filter(r => !isNaN(r.value))
  }
  const parseRobRow = (label: string): IctaRow[] => {
    const m = rawText.match(new RegExp(label + '\\s*\\([^)]+\\)\\s*([\\d.\\s-]+)', 'i'))
    if (!m) return []
    const grades = ['RKR','A','PB','AA','AB','B','C','BBB','AAA']
    return m[1].trim().split(/\s+/).map((v, i) => ({ grade: grades[i] || `G${i}`, value: parseFloat(v) })).filter(r => !isNaN(r.value))
  }
  return {
    date: dateM ? dateM[1] : null,
    arabicaPlantation: parseRow('Arabica Plantation'),
    arabicaCherry: parseRow('Arabica Cherry'),
    robustaParchment: parseRobRow('Robusta Parchment'),
    robustaCherry: parseRobRow('Robusta Cherry'),
  }
}
type KarnatakaRange = { min: number; max: number }
type KarnatakaRanges = Record<string, KarnatakaRange>
function parsePdfKarnatakaRanges(rawText: string | null | undefined): KarnatakaRanges {
  if (!rawText) return {}
  // Find section: "Raw Coffee Price (Karnataka)..." then the line of 4 ranges
  const section = rawText.match(/Raw Coffee Price[^\n]*Karnataka[^\n]*\n([^\n]+)\n([^\n]+)/i)
  if (!section) return {}
  // The ranges are on one of the next two lines
  const rangeLine = [section[1], section[2]].find((line) => /\d+\s*[-–]\s*\d+/.test(line)) ?? ''
  const pairs = [...rangeLine.matchAll(/(\d+)\s*[-–]\s*(\d+)/g)]
  if (pairs.length < 4) return {}
  const keys = ['arabica_parchment', 'arabica_cherry', 'robusta_parchment', 'robusta_cherry']
  const result: KarnatakaRanges = {}
  keys.forEach((key, i) => {
    result[key] = { min: parseInt(pairs[i][1]), max: parseInt(pairs[i][2]) }
  })
  return result
}
// ──────────────────────────────────────────────────────────────────────────────

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

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({} as { message?: string }))
      throw new Error((payload as { message?: string })?.message || `Request failed (${response.status})`)
    }

    return await response.json() as T
  } finally {
    window.clearTimeout(timeoutId)
  }
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
      className={`surface-card rounded-xl ${tone.border} ${tone.glow} p-5 transition duration-300 hover:-translate-y-0.5`}
    >
      <div className="flex items-center gap-3 text-muted-safe">
        <div className="rounded-lg border border-black/10 bg-black/3 p-2 dark:border-white/10 dark:bg-white/5">{icon}</div>
        <p className="text-xs uppercase tracking-[0.28em] text-subtle-safe">{title}</p>
      </div>

      <div className="mt-5 space-y-2 transition duration-300 ease-out">
        <StatusIndicator status={status as PipelineRunStatus} />
        <p className="text-sm text-muted-safe">{timestampText}</p>
        <p className={`text-xs ${freshnessWarning ? 'text-amber-300' : 'text-muted-safe'}`}>
          Updated {timeAgo}
        </p>
        <p className="pt-1 text-xs text-subtle-safe">{subtitle}</p>
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

function formatCoffeePriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
  midpoint: number | null | undefined
) {
  if (min != null && max != null) {
    return `${formatPrice(min * 50)} – ${formatPrice(max * 50)} per 50 kg`
  }
  return formatPrimaryCoffeePrice(midpoint)
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
  const { isDark } = useEffectiveTheme()

  const [products, setProducts] = useState<PriceProduct[]>(DEFAULT_COFFEE_PRODUCTS)
  const [latest, setLatest] = useState<PricesLatestResponse | null>(null)
  const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_COFFEE_PRODUCTS[0]?.productKey || '')
  const [history, setHistory] = useState<PricesHistoryResponse | null>(null)

  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingLatest, setLoadingLatest] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [productsError, setProductsError] = useState<string | null>(null)
  const [latestError, setLatestError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    try {
      const cached = window.localStorage.getItem(LAST_KNOWN_PRICES_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as PricesLatestResponse
        if (parsed?.products?.length) {
          setLatest(parsed)
        }
      }
    } catch {
      // Ignore stale local cache and continue with a live refresh.
    }

    async function loadLatestData() {
      try {
        const latestPayload = await fetchJsonWithTimeout<PricesLatestResponse>(DIRECT_PRICES_LATEST_URL, 15_000)
        if (!mounted) return
        setLatest(latestPayload)
        setLatestError(null)
        window.localStorage.setItem(LAST_KNOWN_PRICES_KEY, JSON.stringify(latestPayload))
      } catch (error) {
        if (!mounted) return
        const message = error instanceof Error && error.name === 'AbortError'
          ? 'Prices request timed out — backend may be starting up. Showing cached data.'
          : error instanceof Error
            ? error.message
            : 'Failed to refresh latest prices.'
        setLatestError(message)
      } finally {
        if (!mounted) return
        setLoadingLatest(false)
      }
    }

    async function loadProducts() {
      setLoadingProducts(true)
      setProductsError(null)

      try {
        const productsPayload = await fetchJsonWithTimeout<PricesProductsResponse>('/api/prices/products', 15_000)
        if (!mounted) return
        const coffeeProducts = productsPayload.products.filter((product) => isCoffeeCommodity(product))
        if (coffeeProducts.length > 0) {
          setProducts(coffeeProducts)
          setSelectedKey((current) => current || coffeeProducts[0].productKey)
        }
        setProductsError(null)
      } catch (error) {
        if (!mounted) return
        const message = error instanceof Error && error.name === 'AbortError'
          ? 'Product list request timed out after 3 seconds.'
          : error instanceof Error
            ? error.message
            : 'Failed to load price dashboard data.'
        setProductsError(message)
      } finally {
        if (!mounted) return
        setLoadingProducts(false)
      }
    }

    setLoadingLatest(true)
    void loadProducts()
    void loadLatestData()
    const intervalId = window.setInterval(() => {
      setLoadingLatest(true)
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
    ? (selectedCoffeeBoardLatest?.todayPriceMin != null && selectedCoffeeBoardLatest?.todayPriceMax != null
        ? `≈ ${formatPrice(selectedCoffeeBoardLatest.value ?? selectedCoffeeBoardLatest.currentPrice)}/kg`
        : formatPer50KgEquivalent(selectedCoffeeBoardLatest?.currentPrice ?? selectedCoffeeBoardLatest?.value))
    : null
  const currentPrimaryDisplay = isCoffeeCommodity(selectedProduct)
    ? formatCoffeePriceRange(
        selectedCoffeeBoardLatest?.todayPriceMin,
        selectedCoffeeBoardLatest?.todayPriceMax,
        selectedCoffeeBoardLatest?.currentPrice ?? selectedCoffeeBoardLatest?.value
      )
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
      sanitizeInsightText(selectedCoffeeBoardLatest?.shortDescription) ||
      sanitizeInsightText(selectedCoffeeBoardLatest?.analysisSummary) ||
      'No reliable structured market summary available.'
    )
  }, [selectedCoffeeBoardLatest])
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

    return items.slice(0, 4)
  }, [selectedCoffeeBoardLatest])
  const reportTitle = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'reportTitle') || selectedCoffeeBoardLatest?.source || 'Coffee Board India'
  const reportDate = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'reportDate')
  const reportSourceUrl = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'reportSourceUrl') || selectedCoffeeBoardLatest?.sourceUrl
  const reportFileName = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'reportFileName')
  const reportRangeOriginal = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'currentRangeOriginal')
  const reportRangeNormalized = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'currentRangeInrPerKg')
  const reportStatus = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'reportStatus')
  const lastCheckedAt = getMetadataString(selectedCoffeeBoardLatest?.metadata, 'lastCheckedAt')
  const latestSuccessfulReportDate = getMetadataString(selectedLatest?.metadata, 'latestSuccessfulReportDate') || reportDate
  const reportStatusBadge = reportStatus === 'LIVE_REPORT'
    ? 'LIVE REPORT'
    : reportStatus === 'PREVIOUS_REPORT_CARRIED_FORWARD'
      ? 'PREVIOUS REPORT CARRIED FORWARD'
      : reportStatus === 'TEMPORARILY_USING_LAST_VERIFIED_REPORT'
        ? 'TEMPORARILY USING LAST VERIFIED REPORT'
        : !selectedCoffeeBoardLatest && isCoffeeCommodity(selectedProduct)
          ? 'COFFEE BOARD DATA REQUIRED'
          : 'REPORT STATUS UNKNOWN'
  const reportStatusMessage = reportStatus === 'TEMPORARILY_USING_LAST_VERIFIED_REPORT'
    ? 'Coffee Board could not be refreshed right now. Showing the last verified market snapshot.'
    : reportStatus === 'PREVIOUS_REPORT_CARRIED_FORWARD'
      ? 'No new Coffee Board report was published today yet. Showing the latest verified market report.'
      : reportStatus === 'LIVE_REPORT'
        ? 'Live Coffee Board report loaded.'
      : !selectedCoffeeBoardLatest && isCoffeeCommodity(selectedProduct)
        ? 'Coffee prices are unavailable because no valid Coffee Board PDF data is present in the latest run.'
      : null
  const coffeeAvailableCount = visibleProducts.filter((product) => {
    const card = latestByKey.get(product.productKey)
    return Boolean(card && isCoffeeBoardSource(card) && (card.currentPrice != null || card.value != null))
  }).length
  const hasLatestData = coffeeCards.length > 0
  const showPriceSkeleton = loadingLatest && !hasLatestData
  const freshnessLabel = lastUpdated ? formatTimeAgo(lastUpdated) : 'Not available'
  const coffeeDashboardStatus = visibleProducts.length > 0 && coffeeAvailableCount === visibleProducts.length
    ? (coffeeCards.some((card) => isCoffeeBoardSource(card) && getMetadataString(card.metadata, 'reportStatus') === 'LIVE_REPORT') ? 'LIVE' : 'VERIFIED')
    : coffeeAvailableCount > 0
      ? 'DEGRADED'
      : 'FAILED'
  const coffeeSummarySubtitle = `${coffeeAvailableCount}/${visibleProducts.length || 4} coffee commodities available`
  const coffeeMidpointDisplay = formatMidpointPerKg(selectedCoffeeBoardLatest?.currentPrice ?? selectedCoffeeBoardLatest?.value)
  const selectedPdfRange = pdfKarnatakaRanges[activeSelectedKey ?? '']
  const currentCoffeePrimaryDisplay = reportRangeOriginal
    || (selectedCoffeeBoardLatest?.todayPriceMin != null && selectedCoffeeBoardLatest?.todayPriceMax != null ? currentPrimaryDisplay : null)
    || (selectedPdfRange ? `${formatPrice(selectedPdfRange.min)} – ${formatPrice(selectedPdfRange.max)} per 50 kg` : null)
    || currentPrimaryDisplay
  const currentCoffeeSecondaryDisplay = reportRangeNormalized
    || (selectedPdfRange ? `≈ ${formatPrice(selectedPdfRange.min / 50)} – ${formatPrice(selectedPdfRange.max / 50)}/kg` : null)
    || currentSecondaryDisplay

  // PDF-derived intelligence
  // rawText is stored in metadata.query by the current backend
  const pdfRawText = selectedCoffeeBoardLatest?.rawText ?? (selectedCoffeeBoardLatest?.metadata?.query as string | undefined)
    ?? (() => { for (const [, obs] of latestByKey) { const q = obs?.metadata?.query as string | undefined; if (q) return q } return undefined })()
  const pdfKarnatakaRanges = parsePdfKarnatakaRanges(pdfRawText)
  const pdfMarketAnalysis = parsePdfMarketAnalysis(pdfRawText)
  const pdfIceFutures = parsePdfIceFutures(pdfRawText)
  const pdfIco = parsePdfIcoIndicator(pdfRawText)
  const pdfIcta = parsePdfIcta(pdfRawText)
  const ictaForSelected: IctaRow[] = activeSelectedKey === 'arabica_cherry' ? (pdfIcta?.arabicaCherry ?? [])
    : activeSelectedKey === 'arabica_parchment' ? (pdfIcta?.arabicaPlantation ?? [])
    : activeSelectedKey === 'robusta_parchment' ? (pdfIcta?.robustaParchment ?? [])
    : activeSelectedKey === 'robusta_cherry' ? (pdfIcta?.robustaCherry ?? [])
    : []
  const isArabica = activeSelectedKey?.startsWith('arabica')

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
              <p className={`mt-2 max-w-2xl text-sm ${isDark ? 'text-[#d5c4b2]' : 'text-muted-safe'}`}>
                {t(
                  'Track today, last week, and next-week outlook per commodity with richer market notes.',
                  'ಪ್ರತಿ ವಸ್ತುವಿಗೆ ಇಂದಿನ, ಕಳೆದ ವಾರದ ಮತ್ತು ಮುಂದಿನ ವಾರದ ಪ್ರವೃತ್ತಿಯನ್ನು ಮಾರುಕಟ್ಟೆ ವಿಶ್ಲೇಷಣೆಯೊಂದಿಗೆ ನೋಡಿ.'
                )}
              </p>
            </div>
            <div className={`text-xs text-right ${isDark ? 'text-[#d5c4b2]' : 'text-muted-safe'}`}>
              <p>{t('Last updated', 'ಕೊನೆಯ ನವೀಕರಣ')}: {freshnessLabel}</p>
              <p>{lastUpdated ? new Date(lastUpdated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</p>
            </div>
          </div>

          {latest?.runHealth?.stale && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
              <span className="font-semibold">⚠️ Using yesterday&apos;s data.</span>{' '}
              {latest.runHealth.staleReason || 'Today\u2019s pipeline run has not completed yet.'}
            </div>
          )}

          {!latest?.runHealth?.stale && coffeeDashboardStatus === 'DEGRADED' && (
            <div className="rounded-2xl border border-amber-300/30 bg-amber-950/15 px-4 py-3 text-sm text-amber-100">
              <span className="font-semibold">⚠️ Partial data.</span>{' '}Some prices are using the last available values.
            </div>
          )}

          {latest?.run?.status === 'FAILED' && (
            <div className="rounded-2xl border border-red-300/40 bg-red-950/25 px-4 py-3 text-sm text-red-100">
              <span className="font-semibold">❌ Data unavailable.</span>{' '}
              {lastUpdated ? `Last successful update: ${new Date(lastUpdated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.` : 'The latest prices run did not complete successfully.'}
            </div>
          )}

          {loadingLatest && !hasLatestData && (
            <div className="lux-stat rounded-xl px-4 py-3 text-sm text-[#d8e8dc]">
              {t('Refreshing coffee prices in the background...', 'ಕಾಫಿ ಬೆಲೆಗಳನ್ನು ಹಿನ್ನಲೆಯಲ್ಲಿ ರಿಫ್ರೆಶ್ ಮಾಡಲಾಗುತ್ತಿದೆ...')}
            </div>
          )}

          {(productsError || latestError) && (
            <div className="rounded-xl border border-red-300/35 bg-red-950/25 px-4 py-3 text-sm text-red-200">
              {productsError || latestError}
            </div>
          )}

          {!loadingProducts && !productsError && !latestError && visibleProducts.length === 0 && (
            <div className="rounded-xl border border-amber-300/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-200">
              {t('No enabled coffee commodities found. Seed products in backend first.', 'ಸಕ್ರಿಯ ಕಾಫಿ ವಸ್ತುಗಳು ಸಿಗಲಿಲ್ಲ. ಮೊದಲು ಬ್ಯಾಕೆಂಡ್‌ನಲ್ಲಿ ಸೀಡ್ ಮಾಡಿ.')}
            </div>
          )}

          {!productsError && visibleProducts.length > 0 && (
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
                  status={reportStatus === 'LIVE_REPORT' ? 'LIVE' : coffeeDashboardStatus}
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
                  const status = !card && showPriceSkeleton ? 'LOADING' : card?.status || 'FAILED'

                  return (
                    <button
                      key={product.productKey}
                      type="button"
                      onClick={() => setSelectedKey(product.productKey)}
                      className={`text-left rounded-2xl p-4 transition ${
                        isDark
                          ? selectedKey === product.productKey
                            ? 'border-emerald-500/60 bg-[#1d1a15]'
                            : 'border-[#2f3a33] bg-[#12100d]/80 hover:border-emerald-400/40'
                          : selectedKey === product.productKey
                            ? 'surface-card-strong border-emerald-500/50'
                            : 'surface-card hover:border-emerald-500/35'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className={`font-semibold ${isDark ? 'text-[#efe4d4]' : 'text-card-strong'}`}>{product.displayName}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          status === 'OK'
                            ? isDark
                              ? 'border-emerald-500/40 text-emerald-300 bg-emerald-900/30'
                              : 'border-emerald-500/30 text-emerald-700 bg-emerald-50'
                            : isDark
                              ? 'border-red-500/40 text-red-300 bg-red-900/30'
                              : 'border-red-500/30 text-red-700 bg-red-50'
                        }`}>
                          {status}
                        </span>
                      </div>
                      {showPriceSkeleton ? (
                        <>
                          <div className={`mt-3 h-8 w-36 animate-pulse rounded-lg ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                          <div className={`mt-2 h-4 w-24 animate-pulse rounded ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                        </>
                      ) : (
                        <>
                          <p className={`mt-2 text-2xl font-bold ${isDark ? 'text-[#f4ead9]' : 'text-card-strong'}`}>
                            {isCoffeeCommodity(product)
                              ? (() => {
                                  const pdfR = pdfKarnatakaRanges[product.productKey]
                                  return formatCoffeePriceRange(
                                    card?.todayPriceMin ?? (pdfR ? pdfR.min / 50 : undefined),
                                    card?.todayPriceMax ?? (pdfR ? pdfR.max / 50 : undefined),
                                    card?.currentPrice ?? card?.value
                                  )
                                })()
                              : formatPrice(card?.currentPrice ?? card?.value)}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-muted-safe'}`}>
                            {isCoffeeCommodity(product)
                              ? (() => {
                                  const pdfR = pdfKarnatakaRanges[product.productKey]
                                  if (pdfR) return `≈ ${formatPrice(pdfR.min / 50)} – ${formatPrice(pdfR.max / 50)}/kg`
                                  return card?.currentPrice != null || card?.value != null ? `≈ ${formatPrice(card?.currentPrice ?? card?.value ?? 0)}/kg` : 'Not available'
                                })()
                              : product.unit}
                          </p>
                        </>
                      )}
                      {card?.trend && <p className={`mt-1 text-xs ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{card.trend}</p>}
                      {card?.error && <p className={`mt-1 text-xs ${isDark ? 'text-red-300' : 'text-red-700'}`}>{card.error}</p>}
                    </button>
                  )
                })}
              </div>

              <div className="surface-app-card rounded-2xl p-5 shadow-lg space-y-5">
                {/* ── Header: commodity name + selector ─────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-2xl text-app-strong">
                      {selectedProduct?.displayName || t('Commodity Detail', 'ವಸ್ತು ವಿವರ')}
                    </h3>
                    <p className="mt-1 text-sm text-app-muted">
                      {reportStatusMessage
                        ? reportStatusMessage
                        : reportDate
                          ? `Coffee Board report · ${reportDate}`
                          : t('Live Coffee Board intelligence.', 'ತಾಜಾ ಕಾಫಿ ಬೋರ್ಡ್ ಮಾಹಿತಿ.')}
                    </p>
                  </div>
                  <div className="max-w-sm min-w-[240px]">
                    <select
                      aria-label="Select commodity"
                      className="surface-app-input w-full p-2.5 rounded-xl font-medium"
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

                {/* ── Top stat row: trend only ──────────────────────────────── */}
                {selectedLatest?.trend && (
                  <div className="surface-app-panel rounded-xl p-4 flex items-center gap-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-app-soft">{t('Trend', 'ಪ್ರವೃತ್ತಿ')}</p>
                    <p className="text-xl font-bold text-app-strong">{selectedLatest.trend}</p>
                    {selectedLatest.confidence != null && (
                      <p className="text-xs text-app-muted ml-auto">{Math.round(selectedLatest.confidence * 100)}% confidence</p>
                    )}
                  </div>
                )}

                {/* ── Market Analysis from PDF ───────────────────────────────────── */}
                {pdfMarketAnalysis && (
                  <div className="surface-app-panel-soft rounded-xl p-4">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-app-soft">Market Analysis · Coffee Board</h4>
                    <p className="mt-3 text-sm leading-7 text-app-body">{pdfMarketAnalysis}</p>
                  </div>
                )}

                {/* ── Main 2-column content area ────────────────────────────────── */}
                <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,0.9fr] gap-5">
                  {/* left: chart + price history context */}
                  <div className="surface-app-card rounded-2xl p-4 space-y-4">
                    {/* ICE Futures mini-table */}
                    {pdfIceFutures.length > 0 && (
                      <div className="surface-app-panel rounded-xl p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-app-soft">ICE Global Futures</h4>
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-sm text-app-body">
                            <thead>
                              <tr className="text-xs text-app-soft border-b border-white/10">
                                <th className="pb-2 text-left font-medium">Month</th>
                                <th className="pb-2 text-right font-medium">Arabica (¢/lb)</th>
                                <th className="pb-2 text-right font-medium">Arabica (₹/kg)</th>
                                <th className="pb-2 text-right font-medium">Robusta ($/t)</th>
                                <th className="pb-2 text-right font-medium">Robusta (₹/kg)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pdfIceFutures.map((row) => (
                                <tr key={row.month} className={`border-b border-white/5 ${isArabica ? 'font-semibold text-app-strong' : ''}`}>
                                  <td className="py-2 text-left">{row.month}</td>
                                  <td className={`py-2 text-right ${isArabica ? 'text-emerald-400' : ''}`}>{row.arabicaCentsLb}</td>
                                  <td className={`py-2 text-right ${isArabica ? 'text-emerald-400' : ''}`}>₹{row.arabicaRsKg}</td>
                                  <td className={`py-2 text-right ${!isArabica ? 'text-emerald-400' : ''}`}>{row.robustaUsdTonne.toLocaleString()}</td>
                                  <td className={`py-2 text-right ${!isArabica ? 'text-emerald-400' : ''}`}>₹{row.robustaRsKg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Price Curve */}
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-lg font-semibold text-app-strong">
                        {t('Price Curve', 'ಬೆಲೆ ವಕ್ರ')}
                      </h4>
                      <p className="text-xs text-app-muted">
                        {dbHistoryChart ? 'Stored historical observations + forecast overlay' : t('Historical observations', 'ಇತಿಹಾಸ')}
                      </p>
                    </div>

                    {loadingHistory && !dbHistoryChart && (
                      <p className="text-sm text-[#d8e8dc]">{t('Loading history...', 'ಇತಿಹಾಸ ಲೋಡ್ ಆಗುತ್ತಿದೆ...')}</p>
                    )}
                    {historyError && !dbHistoryChart && (
                      <p className="text-sm text-red-300">{historyError}</p>
                    )}
                    {!chartConfig && !loadingHistory && (
                      <p className="text-sm text-app-muted">
                        {t('No chartable points available yet.', 'ಇನ್ನೂ ಚಾರ್ಟ್ ಪಾಯಿಂಟ್‌ಗಳು ಲಭ್ಯವಿಲ್ಲ.')}
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
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'top',
                              labels: { color: isDark ? 'rgb(212 212 216)' : 'rgb(82 82 91)' },
                            },
                            tooltip: {
                              backgroundColor: isDark ? 'rgba(9,9,11,0.95)' : 'rgba(255,255,255,0.98)',
                              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(228,228,231,0.9)',
                              borderWidth: 1,
                              titleColor: isDark ? '#fafafa' : '#18181b',
                              bodyColor: isDark ? '#fafafa' : '#18181b',
                            },
                          },
                          scales: {
                            x: {
                              ticks: { color: isDark ? 'rgb(212 212 216)' : 'rgb(82 82 91)', font: { size: 12 } },
                              grid: { color: isDark ? 'rgba(63,63,70,0.5)' : 'rgba(212,212,216,0.7)' },
                              border: { color: isDark ? 'rgb(63 63 70)' : 'rgb(212 212 216)' },
                            },
                            y: {
                              ticks: { color: isDark ? 'rgb(212 212 216)' : 'rgb(82 82 91)', font: { size: 12 } },
                              grid: { color: isDark ? 'rgba(63,63,70,0.5)' : 'rgba(212,212,216,0.7)' },
                              border: { color: isDark ? 'rgb(63 63 70)' : 'rgb(212 212 216)' },
                            },
                          },
                        }}
                      />
                    )}
                  </div>

                  {/* right: ICTA + ICO + source */}
                  <div className="space-y-4">
                    {/* ICTA Auction Prices */}
                    {ictaForSelected.length > 0 && (
                      <div className="surface-app-panel-soft rounded-xl p-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-app-soft">
                          ICTA Auction · {pdfIcta?.date ? `as on ${pdfIcta.date}` : 'Latest'}
                        </h4>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {ictaForSelected.map((row) => (
                            <div key={row.grade} className="surface-app-panel rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-app-soft">{row.grade}</span>
                              <span className="text-sm font-bold text-app-strong">₹{row.value.toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-app-soft">Rs/Kg at ICTA auction · Coffee Board India</p>
                      </div>
                    )}

                    {/* Source */}
                    <div className="surface-app-panel-soft rounded-xl p-4">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-app-soft">{t('Source', 'ಮೂಲ')}</h4>
                      <div className="mt-3 space-y-2">
                        {(selectedLatest?.sources || []).length > 0 ? (
                          (selectedLatest?.sources || []).map((source, index) => (
                            <a
                              key={`${source.url}-${index}`}
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="surface-app-panel block rounded-xl px-3 py-2 text-sm text-app-body hover:bg-zinc-200/80 dark:hover:bg-zinc-800/70"
                            >
                              <div className="font-medium text-app-strong">{source.title || source.host || source.url}</div>
                              <div className="text-xs text-app-soft">{source.host || source.url}</div>
                            </a>
                          ))
                        ) : selectedLatest?.sourceUrl ? (
                          <a
                            href={selectedLatest.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="surface-app-panel block rounded-xl px-3 py-2 text-sm text-app-body hover:bg-zinc-200/80 dark:hover:bg-zinc-800/70"
                          >
                            {selectedLatest.sourceUrl}
                          </a>
                        ) : (
                          <p className="text-sm text-app-muted">
                            {t('No source links captured yet.', 'ಮೂಲ ಲಿಂಕ್‌ಗಳು ಲಭ್ಯವಿಲ್ಲ.')}
                          </p>
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
