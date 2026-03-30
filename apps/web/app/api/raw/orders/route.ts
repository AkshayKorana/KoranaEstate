import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

type BackendRawListing = {
  id: string
  sellerId?: string | null
  commodityName?: string | null
  title?: string | null
  grade?: string | null
  location?: string | null
  quantityKg?: number | string | null
  pricePerKg?: number | string | null
  description?: string | null
  isActive?: boolean | null
  seller?: {
    id?: string
    fullName?: string | null
  } | null
}

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
  sellerNameSnapshot?: string | null
  sellerIdSnapshot?: string | null
  locationSnapshot?: string | null
  unitLabelSnapshot?: string | null
  quantitySnapshot?: number | string | null
  unitPriceSnapshot?: number | string | null
  rawProductId?: string | null
  createdAt?: string
  updatedAt?: string
  message?: string
  error?: string
}

async function getSession() {
  return getServerSession(authOptions)
}

function normalizeCustomer(body: unknown) {
  const customer = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const read = (key: string) => {
    const value = customer[key]
    return typeof value === 'string' ? value.trim() : ''
  }

  return {
    fullName: read('fullName'),
    mobileNumber: read('mobileNumber'),
    addressLine1: read('addressLine1'),
    addressLine2: read('addressLine2'),
    area: read('area'),
    city: read('city'),
    state: read('state'),
    pincode: read('pincode'),
    landmark: read('landmark'),
    orderNote: read('orderNote'),
  }
}

function validateCustomer(customer: ReturnType<typeof normalizeCustomer>) {
  const missing = ['fullName', 'mobileNumber', 'addressLine1', 'area', 'city', 'state', 'pincode'].filter(
    (field) => !customer[field as keyof typeof customer],
  )

  if (missing.length > 0) {
    return `Missing required customer fields: ${missing.join(', ')}`
  }
  if (!/^[6-9]\d{9}$/.test(customer.mobileNumber)) {
    return 'Enter a valid 10-digit mobile number'
  }
  if (!/^\d{6}$/.test(customer.pincode)) {
    return 'Enter a valid 6-digit pincode'
  }

  return null
}

function mapOrder(payload: BackendOrder, session: Awaited<ReturnType<typeof getSession>>) {
  const quantity = Number(payload.quantitySnapshot ?? 0)
  const unitPrice = Number(payload.unitPriceSnapshot ?? 0)
  const createdAt = payload.createdAt ?? new Date().toISOString()
  const updatedAt = payload.updatedAt ?? createdAt

  return {
    id: payload.id ?? '',
    buyerId: payload.buyerId ?? session?.user?.id ?? '',
    sourceType: payload.sourceType ?? 'RAW_MARKETPLACE',
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
    itemName: payload.itemNameSnapshot ?? '',
    itemCategory: payload.itemCategorySnapshot ?? null,
    itemImageUrl: null,
    sellerName: payload.sellerNameSnapshot ?? null,
    sellerId: payload.sellerIdSnapshot ?? null,
    location: payload.locationSnapshot ?? null,
    unitLabel: payload.unitLabelSnapshot ?? 'kg',
    quantity,
    unitPrice,
    createdAt,
    updatedAt,
    buyer: session?.user?.id
      ? {
          id: session.user.id,
          name: session.user.name ?? null,
          email: session.user.email ?? '',
        }
      : undefined,
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const accessToken = session?.accessToken
    if (!accessToken || !session.user?.id || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const listingId = typeof body?.listingId === 'string' ? body.listingId : ''
    const quantityKg = typeof body?.quantityKg === 'number' ? body.quantityKg : Number(body?.quantityKg)
    const customer = normalizeCustomer(body?.customer)

    if (!listingId || !Number.isFinite(quantityKg) || quantityKg <= 0) {
      return NextResponse.json({ error: 'Missing required fields: listingId, quantityKg' }, { status: 400 })
    }

    const customerError = validateCustomer(customer)
    if (customerError) {
      return NextResponse.json({ error: customerError }, { status: 400 })
    }

    const listingsUpstream = await fetch(`${API_BASE}/marketplace/listings`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })
    const listingsText = await listingsUpstream.text()
    const listingsPayload = listingsText ? (JSON.parse(listingsText) as BackendRawListing[] | { message?: string; error?: string }) : []

    if (!listingsUpstream.ok) {
      const error = Array.isArray(listingsPayload) ? 'Failed to fetch listings' : (listingsPayload.message || listingsPayload.error || 'Failed to fetch listings')
      return NextResponse.json({ error }, { status: listingsUpstream.status })
    }

    const listing = (listingsPayload as BackendRawListing[]).find((item) => item.id === listingId)
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    if (listing.isActive === false) {
      return NextResponse.json({ error: 'This listing is no longer available' }, { status: 400 })
    }

    const availableQuantity = Number(listing.quantityKg ?? 0)
    if (quantityKg > availableQuantity) {
      return NextResponse.json({ error: `Available quantity is ${availableQuantity} kg` }, { status: 400 })
    }

    const upstream = await fetch(`${API_BASE}/orders/raw-marketplace`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rawProductId: listingId,
        quantityKg: Number(quantityKg.toFixed(2)),
        customer,
      }),
      cache: 'no-store',
    })

    const text = await upstream.text()
    const payload = text ? (JSON.parse(text) as BackendOrder) : {}

    if (!upstream.ok) {
      const error = payload.message || payload.error || 'Failed to create COD order'
      return NextResponse.json({ error }, { status: upstream.status })
    }

    return NextResponse.json({ order: mapOrder(payload, session) }, { status: 201 })
  } catch (error) {
    console.error('apps/web raw orders POST failed', error)
    return NextResponse.json({ error: 'Failed to create COD order' }, { status: 500 })
  }
}
