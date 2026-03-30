import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractMessage, parseJsonSafely } from '@/app/lib/api-errors'

export const dynamic = 'force-dynamic'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

type BackendStoreProduct = {
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
  items?: Array<{
    retailProductId?: string
    quantity?: number
    unitPrice?: number | string
    retailProduct?: BackendStoreProduct | null
  }>
  buyer?: {
    id?: string
    fullName?: string | null
    email?: string | null
  } | null
  message?: string
  error?: string
}

async function getSession() {
  return getServerSession(authOptions)
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  return extractMessage(payload) || fallback
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
  const fallbackItem = payload.items?.[0]
  const fallbackProduct = fallbackItem?.retailProduct
  const quantity = Number(payload.quantitySnapshot ?? fallbackItem?.quantity ?? 0)
  const unitPrice = Number(payload.unitPriceSnapshot ?? fallbackItem?.unitPrice ?? fallbackProduct?.price ?? 0)
  const createdAt = payload.createdAt ?? new Date().toISOString()
  const updatedAt = payload.updatedAt ?? createdAt

  return {
    id: payload.id ?? '',
    buyerId: payload.buyerId ?? session?.user?.id ?? '',
    sourceType: payload.sourceType ?? 'STORE',
    paymentMethod: payload.paymentMethod ?? 'COD',
    status: (payload.status ?? 'PENDING') as
      | 'PENDING'
      | 'PAID'
      | 'SHIPPED'
      | 'DELIVERED'
      | 'CONFIRMED'
      | 'COMPLETED'
      | 'CANCELLED',
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
    buyer: session?.user?.id
      ? {
          id: session.user.id,
          name: session.user.name ?? null,
          email: session.user.email ?? '',
        }
      : undefined,
    product:
      payload.sourceType === 'STORE' && fallbackProduct
        ? {
            id: fallbackProduct.id,
            sellerId: fallbackProduct.sellerId ?? '',
            name: fallbackProduct.title ?? '',
            category: fallbackProduct.category ?? '',
            price: Number(fallbackProduct.price ?? unitPrice),
            stock: Number(fallbackProduct.stock ?? 0),
            description: fallbackProduct.description ?? null,
            imageUrl: fallbackProduct.imageUrl ?? null,
            isActive: fallbackProduct.isActive ?? true,
            createdAt: fallbackProduct.createdAt ?? createdAt,
            updatedAt: fallbackProduct.updatedAt ?? updatedAt,
            seller: fallbackProduct.seller?.id
              ? {
                  id: fallbackProduct.seller.id,
                  name: fallbackProduct.seller.fullName ?? null,
                  email: '',
                }
              : undefined,
          }
        : undefined,
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const accessToken = typeof session?.accessToken === 'string' ? session.accessToken : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const productId = typeof body?.productId === 'string' ? body.productId : ''
    const quantity = typeof body?.quantity === 'number' ? Math.floor(body.quantity) : parseInt(String(body?.quantity || ''), 10)
    const customer = normalizeCustomer(body?.customer)

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Missing required fields: productId, quantity' }, { status: 400 })
    }

    const customerError = validateCustomer(customer)
    if (customerError) {
      return NextResponse.json({ error: customerError }, { status: 400 })
    }

    const productsUpstream = await fetch(`${API_BASE}/store/products`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })
    const productsText = await productsUpstream.text()
    const productsPayload = parseJsonSafely<BackendStoreProduct[] | { message?: string; error?: string }>(productsText) ?? []

    if (!productsUpstream.ok) {
      const error = Array.isArray(productsPayload) ? 'Failed to fetch products' : getApiErrorMessage(productsPayload, 'Failed to fetch products')
      return NextResponse.json({ error }, { status: productsUpstream.status })
    }

    const product = (productsPayload as BackendStoreProduct[]).find((item) => item.id === productId)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if (product.isActive === false) {
      return NextResponse.json({ error: 'This product is no longer available' }, { status: 400 })
    }

    const stock = Number(product.stock ?? 0)
    if (quantity > stock) {
      return NextResponse.json({ error: `Insufficient stock. Available: ${stock}` }, { status: 400 })
    }

    const upstream = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ productId, quantity }],
        customer,
      }),
      cache: 'no-store',
    })

    const text = await upstream.text()
    const payload = parseJsonSafely<BackendOrder>(text) ?? {}

    if (!upstream.ok) {
      const error = getApiErrorMessage(payload, 'Failed to create order')
      return NextResponse.json({ error }, { status: upstream.status })
    }

    return NextResponse.json({ order: mapOrder(payload, session) }, { status: 201 })
  } catch (error) {
    console.error('apps/web orders POST failed', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
