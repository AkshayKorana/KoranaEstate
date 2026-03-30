import { NextRequest, NextResponse } from 'next/server'
import { extractMessage, parseJsonSafely } from '@/app/lib/api-errors'
import { getAccessTokenFromRequest } from '@/app/api/_lib/auth'

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

function mapOrder(payload: BackendOrder) {
  const fallbackItem = payload.items?.[0]
  const fallbackProduct = fallbackItem?.retailProduct
  const quantity = Number(payload.quantitySnapshot ?? fallbackItem?.quantity ?? 0)
  const unitPrice = Number(payload.unitPriceSnapshot ?? fallbackItem?.unitPrice ?? fallbackProduct?.price ?? 0)
  const createdAt = payload.createdAt ?? new Date().toISOString()
  const updatedAt = payload.updatedAt ?? createdAt

  return {
    id: payload.id ?? '',
    buyerId: payload.buyerId ?? '',
    sourceType: payload.sourceType ?? 'STORE',
    paymentMethod: payload.paymentMethod ?? 'COD',
    status: payload.status ?? 'PENDING',
    rawProductId: payload.rawProductId ?? null,
    totalPrice: Number(payload.totalAmount ?? quantity * unitPrice),
    shippingAddress: payload.shippingAddress ?? null,
    customer: {
      fullName: payload.customerName ?? '',
      mobileNumber: payload.phone ?? '',
      addressLine1: payload.addressLine1 ?? '',
      addressLine2: payload.addressLine2 ?? '',
      area: payload.area ?? '',
      city: payload.city ?? '',
      state: payload.state ?? '',
      pincode: payload.pincode ?? '',
      landmark: payload.landmark ?? '',
      orderNote: payload.orderNote ?? '',
    },
    itemName: payload.itemNameSnapshot ?? fallbackProduct?.title ?? '',
    itemCategory: payload.itemCategorySnapshot ?? fallbackProduct?.category ?? null,
    itemImageUrl: payload.itemImageUrlSnapshot ?? fallbackProduct?.imageUrl ?? null,
    sellerName: payload.sellerNameSnapshot ?? fallbackProduct?.seller?.fullName ?? null,
    sellerId: payload.sellerIdSnapshot ?? fallbackProduct?.sellerId ?? fallbackProduct?.seller?.id ?? null,
    location: payload.locationSnapshot ?? null,
    unitLabel: payload.unitLabelSnapshot ?? 'unit',
    quantity,
    unitPrice,
    createdAt,
    updatedAt,
  }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const accessToken = await getAccessTokenFromRequest(_request)
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await context.params
    const upstream = await fetch(`${API_BASE}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    const text = await upstream.text()
    const payload = parseJsonSafely<BackendOrder>(text) ?? {}

    if (!upstream.ok) {
      const error = getApiErrorMessage(payload, 'Failed to fetch order')
      return NextResponse.json({ error }, { status: upstream.status })
    }

    return NextResponse.json({ order: mapOrder(payload) })
  } catch (error) {
    console.error('apps/web orders/[orderId] GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 })
  }
}
