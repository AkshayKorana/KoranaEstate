import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractMessage, parseJsonSafely } from '@/app/lib/api-errors'
import { attachRefreshedSession, fetchWithAuthRetry } from '@/app/api/_lib/auth'
import { sendStoreOrderEmails } from '@/lib/email'

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

function mapOrder(payload: BackendOrder | null | undefined, session: Awaited<ReturnType<typeof getSession>>) {
  if (!payload) {
    return null
  }

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
    console.log('═══════════════════════════════════════')
    console.log('[STORE API] POST /api/orders RECEIVED')
    
    const session = await getSession()
    console.log('[STORE API] Session user:', session?.user?.email)

    const body = await request.json()
    console.log('[STORE API] Request body:', { productId: body?.productId, quantity: body?.quantity })
    
    const productId = typeof body?.productId === 'string' ? body.productId : ''
    const quantity = typeof body?.quantity === 'number' ? Math.floor(body.quantity) : parseInt(String(body?.quantity || ''), 10)
    const customer = normalizeCustomer(body?.customer)

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      console.log('[STORE API] Validation failed: missing/invalid fields')
      return NextResponse.json({ error: 'Missing required fields: productId, quantity' }, { status: 400 })
    }

    const customerError = validateCustomer(customer)
    if (customerError) {
      console.log('[STORE API] Customer validation failed:', customerError)
      return NextResponse.json({ error: customerError }, { status: 400 })
    }

    console.log('[STORE API] Fetching products from backend...')
    const productsResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/store/products`,
      method: 'GET',
    })
    if ('errorResponse' in productsResult) {
      console.log('[STORE API] Failed to fetch products')
      return productsResult.errorResponse
    }

    const productsText = await productsResult.upstream.text()
    const productsPayload = parseJsonSafely<BackendStoreProduct[] | { message?: string; error?: string }>(productsText) ?? []

    if (!productsResult.upstream.ok) {
      const error = Array.isArray(productsPayload) ? 'Failed to fetch products' : getApiErrorMessage(productsPayload, 'Failed to fetch products')
      console.log('[STORE API] Products fetch returned error:', error)
      const response = NextResponse.json({ error }, { status: productsResult.upstream.status })
      return attachRefreshedSession(request, response, productsResult.authToken, productsResult.refreshed)
    }

    const product = (productsPayload as BackendStoreProduct[]).find((item) => item.id === productId)
    if (!product) {
      console.log('[STORE API] Product not found:', productId)
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if (product.isActive === false) {
      console.log('[STORE API] Product inactive:', productId)
      return NextResponse.json({ error: 'This product is no longer available' }, { status: 400 })
    }

    const stock = Number(product.stock ?? 0)
    if (quantity > stock) {
      console.log('[STORE API] Insufficient stock:', { requested: quantity, available: stock })
      return NextResponse.json({ error: `Insufficient stock. Available: ${stock}` }, { status: 400 })
    }

    console.log('[STORE API] Calling backend POST /api/v1/orders...')
    console.log('[STORE API] Payload:', { items: [{ productId, quantity }], customer })
    
    const upstreamResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/orders`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ productId, quantity }],
        customer,
      }),
    })
    if ('errorResponse' in upstreamResult) {
      console.log('[STORE API] Backend call failed - errorResponse')
      return upstreamResult.errorResponse
    }

    const text = await upstreamResult.upstream.text()
    console.log('[STORE API] Backend response status:', upstreamResult.upstream.status)
    console.log('[STORE API] Backend response body:', text.substring(0, 500))
    
    const payload = parseJsonSafely<BackendOrder>(text) ?? {}

    if (!upstreamResult.upstream.ok) {
      const error = getApiErrorMessage(payload, 'Failed to create order')
      console.log('[STORE API] Backend returned error:', error)
      const response = NextResponse.json({ error }, { status: upstreamResult.upstream.status })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const order = mapOrder(payload, session)
    if (!order) {
      console.log('[STORE API] Failed to map order response')
      const response = NextResponse.json({ error: 'Created order response was incomplete' }, { status: 502 })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    console.log('[STORE API] ✅ Order created successfully:', order.id)
    console.log('═══════════════════════════════════════')

    // Fire order confirmation emails (user + admin) — non-blocking
    const buyerEmail = session?.user?.email ?? order.buyer?.email ?? ''
    if (buyerEmail) {
      sendStoreOrderEmails({
        orderId: order.id,
        buyerName: order.customer.fullName || (session?.user?.name ?? 'Customer'),
        buyerEmail,
        itemName: order.itemName,
        itemCategory: order.itemCategory,
        sellerName: order.sellerName,
        quantity: order.quantity,
        unitLabel: order.unitLabel,
        unitPrice: order.unitPrice,
        totalPrice: order.totalPrice,
        addressLine1: order.customer.addressLine1,
        addressLine2: order.customer.addressLine2,
        area: order.customer.area,
        city: order.customer.city,
        state: order.customer.state,
        pincode: order.customer.pincode,
        landmark: order.customer.landmark,
        mobileNumber: order.customer.mobileNumber,
        orderNote: order.customer.orderNote,
      }).catch((err) => console.error('[STORE API] Order email error:', err))
    }

    const response = NextResponse.json({ order }, { status: 201 })
    return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('═══════════════════════════════════════')
    console.error('[STORE API] ❌ CRASH:', error)
    console.error('═══════════════════════════════════════')
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const upstreamResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/orders/me`,
      method: 'GET',
    })
    if ('errorResponse' in upstreamResult) {
      return upstreamResult.errorResponse
    }

    const text = await upstreamResult.upstream.text()
    const payload = parseJsonSafely<BackendOrder[] | { message?: string; error?: string }>(text) ?? []

    if (!upstreamResult.upstream.ok) {
      const error = Array.isArray(payload) ? 'Failed to fetch orders' : getApiErrorMessage(payload, 'Failed to fetch orders')
      const response = NextResponse.json({ error }, { status: upstreamResult.upstream.status })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const orders = (Array.isArray(payload) ? payload : [])
      .map((order) => mapOrder(order, session))
      .filter((order): order is NonNullable<ReturnType<typeof mapOrder>> => Boolean(order))

    const response = NextResponse.json({ orders })
    return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('apps/web orders GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
