import { NextRequest, NextResponse } from 'next/server'
import { extractMessage, parseJsonSafely } from '@/app/lib/api-errors'
import { attachRefreshedSession, fetchWithAuthRetry } from '@/app/api/_lib/auth'

export const dynamic = 'force-dynamic'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

type BackendOrder = {
  id?: string
  buyerId?: string
  sourceType?: 'STORE' | 'RAW_MARKETPLACE'
  paymentMethod?: 'COD'
  status?: string
  totalAmount?: number | string
  shippingAddress?: string | null
  customerName?: string | null
  phone?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  area?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  landmark?: string | null
  orderNote?: string | null
  itemNameSnapshot?: string | null
  itemCategorySnapshot?: string | null
  itemImageUrlSnapshot?: string | null
  sellerNameSnapshot?: string | null
  sellerIdSnapshot?: string | null
  locationSnapshot?: string | null
  unitLabelSnapshot?: string | null
  quantitySnapshot?: number | string | null
  unitPriceSnapshot?: number | string | null
  rawProductId?: string | null
  createdAt?: string
  updatedAt?: string
  buyer?: {
    id?: string
    fullName?: string | null
    email?: string | null
  } | null
  items?: Array<{
    retailProductId?: string
    quantity?: number
    unitPrice?: number | string
    retailProduct?: {
      id: string
      sellerId?: string | null
      title?: string | null
      category?: string | null
      imageUrl?: string | null
      price?: number | string | null
      stock?: number | null
      description?: string | null
      isActive?: boolean | null
      createdAt?: string | null
      updatedAt?: string | null
      seller?: {
        id?: string
        fullName?: string | null
      } | null
    } | null
  }>
  message?: string
  error?: string
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  return extractMessage(payload) || fallback
}

function mapOrder(payload: BackendOrder | null | undefined) {
  const safePayload = payload ?? {}
  const fallbackItem = safePayload.items?.[0]
  const fallbackProduct = fallbackItem?.retailProduct
  const quantity = Number(safePayload.quantitySnapshot ?? fallbackItem?.quantity ?? 0)
  const unitPrice = Number(safePayload.unitPriceSnapshot ?? fallbackItem?.unitPrice ?? fallbackProduct?.price ?? 0)
  const createdAt = safePayload.createdAt ?? new Date().toISOString()
  const updatedAt = safePayload.updatedAt ?? createdAt

  return {
    id: safePayload.id ?? '',
    buyerId: safePayload.buyerId ?? '',
    sourceType: safePayload.sourceType ?? 'STORE',
    paymentMethod: safePayload.paymentMethod ?? 'COD',
    status: safePayload.status ?? 'PENDING',
    rawProductId: safePayload.rawProductId ?? null,
    totalPrice: Number(safePayload.totalAmount ?? quantity * unitPrice),
    shippingAddress: safePayload.shippingAddress ?? null,
    customer: {
      fullName: safePayload.customerName ?? '',
      mobileNumber: safePayload.phone ?? '',
      addressLine1: safePayload.addressLine1 ?? '',
      addressLine2: safePayload.addressLine2 ?? '',
      area: safePayload.area ?? '',
      city: safePayload.city ?? '',
      state: safePayload.state ?? '',
      pincode: safePayload.pincode ?? '',
      landmark: safePayload.landmark ?? '',
      orderNote: safePayload.orderNote ?? '',
    },
    itemName: safePayload.itemNameSnapshot ?? fallbackProduct?.title ?? '',
    itemCategory: safePayload.itemCategorySnapshot ?? fallbackProduct?.category ?? null,
    itemImageUrl: safePayload.itemImageUrlSnapshot ?? fallbackProduct?.imageUrl ?? null,
    sellerName: safePayload.sellerNameSnapshot ?? fallbackProduct?.seller?.fullName ?? null,
    sellerId: safePayload.sellerIdSnapshot ?? fallbackProduct?.sellerId ?? fallbackProduct?.seller?.id ?? null,
    location: safePayload.locationSnapshot ?? null,
    unitLabel: safePayload.unitLabelSnapshot ?? 'unit',
    quantity,
    unitPrice,
    createdAt,
    updatedAt,
  }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params
    const upstreamResult = await fetchWithAuthRetry({
      request: _request,
      url: `${API_BASE}/orders/${orderId}`,
      method: 'GET',
    })
    if ('errorResponse' in upstreamResult) {
      return upstreamResult.errorResponse
    }

    const text = await upstreamResult.upstream.text()
    const payload = parseJsonSafely<BackendOrder>(text) ?? {}

    if (!upstreamResult.upstream.ok) {
      const error = getApiErrorMessage(payload, 'Failed to fetch order')
      const response = NextResponse.json({ error }, { status: upstreamResult.upstream.status })
      return attachRefreshedSession(_request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const response = NextResponse.json({ order: mapOrder(payload) })
    return attachRefreshedSession(_request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('apps/web orders/[orderId] GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}
