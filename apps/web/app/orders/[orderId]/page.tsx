'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffectiveTheme } from '@/app/theme-context'
import type { Order } from '@/types/marketplace'
import { extractErrorMessage } from '@/app/lib/api-errors'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatOrderStatus(status: Order['status']) {
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-200/70 py-3 last:border-b-0 dark:border-white/10">
      <span className="text-sm font-medium text-app-muted">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-semibold text-app-body">{value}</span>
    </div>
  )
}

export default function OrderConfirmationPage() {
  const params = useParams<{ orderId: string }>()
  const router = useRouter()
  const { status: sessionStatus } = useSession()
  const { isDark } = useEffectiveTheme()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.replace('/auth')
      return
    }
    if (sessionStatus === 'loading') return

    const orderId = params?.orderId
    if (!orderId) return

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' })
        if (!res.ok) {
          setError((await extractErrorMessage(res)) || 'Failed to load order')
          return
        }
        const data = await res.json()
        setOrder(data.order ?? null)
      } catch (loadError) {
        console.error('Failed to load order confirmation', loadError)
        setError('Failed to load order')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params?.orderId, sessionStatus, router])

  const addressText = useMemo(() => {
    if (!order) return ''
    return [
      order.customer.addressLine1,
      order.customer.addressLine2,
      order.customer.landmark,
      order.customer.area,
      order.customer.city,
      order.customer.state,
      order.customer.pincode,
    ]
      .filter(Boolean)
      .join(', ')
  }, [order])

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto max-w-4xl px-6 md:px-8 lg:px-10">
        <div className="mb-8 slide-in-up">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-4 rounded-2xl gradient-brand-spectrum">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="font-luxe text-4xl font-bold text-brand-spectrum">Order Confirmed</h1>
              <p className={`mt-2 text-base ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>
                Your cash-on-delivery order has been placed successfully.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="surface-app-card rounded-3xl p-10 text-center text-app-body">Loading order confirmation...</div>
        ) : error || !order ? (
          <div className="surface-app-card rounded-3xl p-10 text-center">
            <p className="text-lg font-semibold text-app-strong">{error || 'Order not found'}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/store" className="surface-app-button-secondary rounded-xl px-5 py-3 font-semibold">
                Back to Store
              </Link>
              <Link href="/raw-marketplace" className="surface-app-button-secondary rounded-xl px-5 py-3 font-semibold">
                View Marketplace
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="surface-app-card rounded-3xl p-6 md:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-4">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 via-yellow-50 to-emerald-50 flex items-center justify-center">
                    {order.itemImageUrl ? (
                      <img src={order.itemImageUrl} alt={order.itemName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-4xl">☕</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-app-soft">Order receipt</p>
                    <h2 className="mt-2 text-2xl font-bold text-app-strong">{order.itemName}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="surface-app-chip rounded-full px-3 py-1 text-xs font-semibold">
                        {order.sourceType === 'STORE' ? 'Store' : 'Raw Marketplace'}
                      </span>
                      <span className="surface-app-chip rounded-full px-3 py-1 text-xs font-semibold">
                        {formatOrderStatus(order.status)}
                      </span>
                      <span className="surface-app-chip rounded-full px-3 py-1 text-xs font-semibold">
                        Cash on Delivery
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-app-muted">
                      {order.sellerName ? `Seller: ${order.sellerName}` : 'Seller details available in your order record.'}
                    </p>
                  </div>
                </div>
                <div className="surface-app-panel rounded-2xl p-4 min-w-[220px]">
                  <p className="text-sm font-medium text-app-muted">Order total</p>
                  <p className="mt-2 text-3xl font-bold text-app-strong">{formatCurrency(order.totalPrice)}</p>
                  <p className="mt-1 text-sm text-app-soft">
                    {formatCurrency(order.unitPrice)} x {order.quantity} {order.unitLabel}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="surface-app-card rounded-3xl p-6">
                <h3 className="text-xl font-bold text-app-strong">Order details</h3>
                <div className="mt-4">
                  <DetailRow label="Order ID" value={order.id} />
                  <DetailRow label="Order date" value={new Date(order.createdAt).toLocaleString('en-IN')} />
                  <DetailRow label="Source" value={order.sourceType === 'STORE' ? 'Store' : 'Raw Marketplace'} />
                  <DetailRow label="Quantity" value={`${order.quantity} ${order.unitLabel}`} />
                  <DetailRow label="Unit price" value={formatCurrency(order.unitPrice)} />
                  <DetailRow label="Total amount" value={formatCurrency(order.totalPrice)} />
                  <DetailRow label="Payment method" value="Cash on Delivery" />
                  <DetailRow label="Current status" value={formatOrderStatus(order.status)} />
                  {order.itemCategory ? <DetailRow label="Category / grade" value={order.itemCategory} /> : null}
                  {order.location ? <DetailRow label="Location" value={order.location} /> : null}
                </div>
              </section>

              <section className="surface-app-card rounded-3xl p-6">
                <h3 className="text-xl font-bold text-app-strong">Delivery details</h3>
                <div className="mt-4">
                  <DetailRow label="Customer" value={order.customer.fullName} />
                  <DetailRow label="Mobile" value={order.customer.mobileNumber} />
                  <DetailRow label="Address" value={addressText || order.shippingAddress || 'Not provided'} />
                  {order.customer.orderNote ? <DetailRow label="Order note" value={order.customer.orderNote} /> : null}
                </div>
              </section>
            </div>

            <section className="surface-app-panel-soft rounded-3xl p-6">
              <h3 className="text-lg font-bold text-app-strong">What happens next</h3>
              <p className="mt-2 text-sm leading-6 text-app-muted">
                Your seller can now confirm the order and prepare dispatch. You will pay in cash when the order is delivered.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={order.sourceType === 'STORE' ? '/store' : '/raw-marketplace'}
                  className="gradient-brand-spectrum rounded-xl px-5 py-3 font-semibold text-white shadow-md transition-all hover:shadow-lg"
                >
                  {order.sourceType === 'STORE' ? 'Continue shopping' : 'View marketplace'}
                </Link>
                <Link href="/messages" className="surface-app-button-secondary rounded-xl px-5 py-3 font-semibold">
                  Go to Messages
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
