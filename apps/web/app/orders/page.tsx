'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { Order, OrdersResponse } from '@/types/marketplace'
import { useLanguage } from '@/app/language-context'
import { useEffectiveTheme } from '@/app/theme-context'
import { extractErrorMessage } from '@/app/lib/api-errors'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatStatus(status: Order['status']) {
  const labels: Record<Order['status'], string> = {
    PENDING: 'Placed',
    CONFIRMED: 'Confirmed',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    PAID: 'Paid',
  }
  return labels[status] ?? status
}

export default function OrdersPage() {
  const router = useRouter()
  const { status } = useSession({
    required: true,
    onUnauthenticated: () => router.replace('/auth'),
  })
  const { t } = useLanguage()
  const { isDark } = useEffectiveTheme()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = () => setRefreshKey(k => k + 1)

  useEffect(() => {
    if (status !== 'authenticated') return

    let mounted = true
    async function loadOrders() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/orders', { cache: 'no-store' })
        if (!res.ok) {
          throw new Error((await extractErrorMessage(res)) || 'Failed to load orders.')
        }
        const data: OrdersResponse = await res.json()
        if (!mounted) return
        setOrders(data.orders || [])
      } catch (loadError) {
        if (!mounted) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load orders.')
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadOrders()

    // Refresh when tab regains focus so a new order placed externally shows up
    const onFocus = () => { if (mounted) void loadOrders() }
    window.addEventListener('focus', onFocus)

    return () => {
      mounted = false
      window.removeEventListener('focus', onFocus)
    }
  }, [status, refreshKey])

  if (status === 'loading') {
    return null
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto max-w-6xl px-6 md:px-8 lg:px-10">
        <div className="mb-8 slide-in-up">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl gradient-brand-spectrum">
                <span className="text-3xl">📦</span>
              </div>
              <div>
                <h1 className="font-luxe text-4xl font-bold text-brand-spectrum">{t('Your Orders', 'ನಿಮ್ಮ ಆರ್ಡರ್‌ಗಳು')}</h1>
                <p className={`mt-2 text-base ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>
                  {t('Track your recent Store and Raw Marketplace COD orders.', 'ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಸ್ಟೋರ್ ಮತ್ತು ರಾ ಮಾರುಕಟ್ಟೆ COD ಆರ್ಡರ್‌ಗಳನ್ನು ನೋಡಿ.')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="mt-1 shrink-0 surface-app-button-secondary rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? '…' : t('Refresh', 'ರಿಫ್ರೆಶ್')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="surface-app-card rounded-3xl p-10 text-center text-app-body">
            {t('Loading orders...', 'ಆರ್ಡರ್‌ಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...')}
          </div>
        ) : error ? (
          <div className="surface-app-card rounded-3xl p-10 text-center">
            <p className="text-lg font-semibold text-app-strong">{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="surface-app-card rounded-3xl p-10 text-center">
            <p className="text-lg font-semibold text-app-strong">{t('No orders yet', 'ಇನ್ನೂ ಆರ್ಡರ್‌ಗಳಿಲ್ಲ')}</p>
            <p className="mt-2 text-sm text-app-muted">
              {t('Your COD orders from the Store and Raw Marketplace will appear here.', 'ಸ್ಟೋರ್ ಮತ್ತು ರಾ ಮಾರುಕಟ್ಟೆಯಿಂದ ನಿಮ್ಮ COD ಆರ್ಡರ್‌ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.')}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/store" className="surface-app-button-secondary rounded-xl px-5 py-3 font-semibold">
                {t('Go to Store', 'ಸ್ಟೋರ್‌ಗೆ ಹೋಗಿ')}
              </Link>
              <Link href="/raw-marketplace" className="surface-app-button-secondary rounded-xl px-5 py-3 font-semibold">
                {t('View Marketplace', 'ಮಾರುಕಟ್ಟೆ ನೋಡಿ')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="surface-app-card rounded-3xl p-5 transition-all hover:shadow-lg"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="surface-app-chip rounded-full px-3 py-1 text-xs font-semibold">
                        {order.sourceType === 'STORE' ? 'Store' : 'Raw Marketplace'}
                      </span>
                      <span className="surface-app-chip rounded-full px-3 py-1 text-xs font-semibold">
                        COD
                      </span>
                      <span className="surface-app-chip rounded-full px-3 py-1 text-xs font-semibold">
                        {formatStatus(order.status)}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-app-strong">{order.itemName}</h2>
                    <p className="text-sm text-app-muted">#{order.id}</p>
                    <p className="text-sm text-app-soft">
                      {new Date(order.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="grid gap-2 text-right">
                    <p className="text-sm text-app-muted">
                      {order.quantity} {order.unitLabel}
                    </p>
                    <p className="text-lg font-bold text-app-strong">{formatCurrency(order.totalPrice)}</p>
                    <p className="text-sm text-app-soft">{t('Payment', 'ಪಾವತಿ')}: Cash on Delivery</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
