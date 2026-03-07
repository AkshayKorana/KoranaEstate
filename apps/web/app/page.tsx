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
type ProductReason = 'NO_DATA' | 'MISSING_IN_RUN' | null

type PriceProduct = {
  productKey: string
  displayName: string
  unit: string
  defaultSource: string | null
  sourceUrl: string | null
  displayOrder: number
  enabled: boolean
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
}

type PricesHistoryResponse = {
  updatedAt: string
  product: PriceProduct
  days: number
  history: PriceHistoryPoint[]
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

    async function load() {
      setLoadingProducts(true)
      setLoadingLatest(true)
      setProductsError(null)
      setLatestError(null)

      try {
        const [productsRes, latestRes] = await Promise.all([
          fetch('/api/prices/products', { cache: 'no-store' }),
          fetch('/api/prices/latest', { cache: 'no-store' }),
        ])

        if (!productsRes.ok) {
          const payload = await productsRes.json().catch(() => ({}))
          throw new Error(payload?.message || `Products request failed (${productsRes.status})`)
        }

        if (!latestRes.ok) {
          const payload = await latestRes.json().catch(() => ({}))
          throw new Error(payload?.message || `Latest request failed (${latestRes.status})`)
        }

        const productsPayload: PricesProductsResponse = await productsRes.json()
        const latestPayload: PricesLatestResponse = await latestRes.json()

        if (!mounted) return

        setProducts(productsPayload.products)
        setLatest(latestPayload)

        if (productsPayload.products.length > 0) {
          setSelectedKey((current) => current || productsPayload.products[0].productKey)
        }
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
    return () => {
      mounted = false
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
    for (const row of latest?.products || []) map.set(row.productKey, row)
    return map
  }, [latest])

  const selectedProduct = useMemo(
    () => products.find((product) => product.productKey === selectedKey) || null,
    [products, selectedKey]
  )

  const chartPoints = (history?.history || []).filter((point) => point.value != null)

  const lastUpdated = latest?.run?.runAt || latest?.updatedAt || null

  return (
    <div id="top" className="space-y-14">
      <div>
        <Hero />
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-10 space-y-8">
        <section className="luxe-surface p-6 rounded-3xl shadow-lg space-y-6 section-reveal">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-luxe text-3xl font-bold text-[#f6e8d7]">
              {t('Commodity Price Dashboard', 'ವಸ್ತು ಬೆಲೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್')}
            </h2>
            <p className="text-xs text-[#d5c4b2]">
              {t('Last updated', 'ಕೊನೆಯ ನವೀಕರಣ')}: {lastUpdated ? new Date(lastUpdated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
            </p>
          </div>

          {(loadingProducts || loadingLatest) && (
            <div className="lux-stat rounded-xl px-4 py-3 text-sm text-[#d8e8dc]">
              {t('Loading prices...', 'ಬೆಲೆಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...')}
            </div>
          )}

          {(productsError || latestError) && (
            <div className="rounded-xl border border-red-300/35 bg-red-950/25 px-4 py-3 text-sm text-red-200">
              {productsError || latestError}
            </div>
          )}

          {!loadingProducts && !loadingLatest && !productsError && !latestError && products.length === 0 && (
            <div className="rounded-xl border border-amber-300/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-200">
              {t('No enabled products found. Seed products in backend first.', 'ಸಕ್ರಿಯ ಉತ್ಪನ್ನಗಳು ಸಿಗಲಿಲ್ಲ. ಮೊದಲು ಬ್ಯಾಕೆಂಡ್‌ನಲ್ಲಿ ಸೀಡ್ ಮಾಡಿ.')}
            </div>
          )}

          {!loadingProducts && !loadingLatest && !productsError && !latestError && products.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map((product) => {
                  const card = latestByKey.get(product.productKey)
                  const status = card?.status || 'FAILED'
                  const valueText = card?.value != null
                    ? `₹${card.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                    : '-'

                  return (
                    <button
                      key={product.productKey}
                      type="button"
                      onClick={() => setSelectedKey(product.productKey)}
                      className={`text-left rounded-2xl border p-4 transition ${selectedKey === product.productKey ? 'border-emerald-500/60 bg-[#1d1a15]' : 'border-[#2f3a33] bg-[#12100d]/80 hover:border-emerald-400/40'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-[#efe4d4]">{product.displayName}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${status === 'OK' ? 'border-emerald-500/40 text-emerald-300 bg-emerald-900/30' : 'border-red-500/40 text-red-300 bg-red-900/30'}`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-[#f4ead9] mt-2">{valueText}</p>
                      <p className="text-xs text-gray-400">{product.unit}</p>
                      {card?.reason && <p className="text-xs text-amber-300 mt-1">{card.reason}</p>}
                      {card?.error && <p className="text-xs text-red-300 mt-1">{card.error}</p>}
                    </button>
                  )
                })}
              </div>

              <div className="rounded-2xl bg-[#171411]/80 border border-emerald-200/25 p-5 shadow-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold text-xl text-[#efe4d4]">
                    {selectedProduct?.displayName || t('Price History', 'ಬೆಲೆ ಇತಿಹಾಸ')}
                  </h3>
                  <div className="max-w-sm min-w-[220px]">
                    <select
                      aria-label="Select product"
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

                {loadingHistory && (
                  <p className="text-sm text-[#d8e8dc]">{t('Loading history...', 'ಇತಿಹಾಸ ಲೋಡ್ ಆಗುತ್ತಿದೆ...')}</p>
                )}

                {historyError && (
                  <p className="text-sm text-red-300">{historyError}</p>
                )}

                {!loadingHistory && !historyError && chartPoints.length === 0 && (
                  <p className="text-sm text-gray-400">{t('No history available for this product yet.', 'ಈ ಉತ್ಪನ್ನಕ್ಕೆ ಇನ್ನೂ ಇತಿಹಾಸ ಲಭ್ಯವಿಲ್ಲ.')}</p>
                )}

                {!loadingHistory && !historyError && chartPoints.length > 0 && (
                  <Line
                    data={{
                      labels: chartPoints.map((point) =>
                        new Date(point.capturedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                      ),
                      datasets: [
                        {
                          label: `${selectedProduct?.displayName || 'Price'} (${selectedProduct?.unit || 'INR/kg'})`,
                          data: chartPoints.map((point) => point.value),
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
            </>
          )}
        </section>
      </div>

      <Footer />
    </div>
  )
}
