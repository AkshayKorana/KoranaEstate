import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

type BackendStoreProduct = {
  id: string
  sellerId?: string | null
  title?: string | null
  category?: string | null
  price?: number | string | null
  stock?: number | null
  description?: string | null
  isActive?: boolean | null
  createdAt?: string | null
  updatedAt?: string | null
}

type BackendOrder = {
  id?: string
  buyerId?: string
  status?: string
  totalAmount?: number | string
  shippingAddress?: string | null
  createdAt?: string
  updatedAt?: string
  items?: Array<{
    retailProductId?: string
    quantity?: number
    unitPrice?: number | string
  }>
  message?: string
  error?: string
}

async function getSession() {
  return getServerSession(authOptions)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const accessToken = session?.accessToken
    if (!accessToken || !session.user?.id || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const productId = typeof body?.productId === 'string' ? body.productId : ''
    const quantity = typeof body?.quantity === 'number' ? Math.floor(body.quantity) : parseInt(String(body?.quantity || ''), 10)
    const shippingAddress = typeof body?.shippingAddress === 'string' ? body.shippingAddress.trim() : null
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : null

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Missing required fields: productId, quantity' }, { status: 400 })
    }

    const productsUpstream = await fetch(`${API_BASE}/store/products`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })
    const productsText = await productsUpstream.text()
    const productsPayload = productsText ? (JSON.parse(productsText) as BackendStoreProduct[] | { message?: string; error?: string }) : []

    if (!productsUpstream.ok) {
      const error = Array.isArray(productsPayload) ? 'Failed to fetch products' : (productsPayload.message || productsPayload.error || 'Failed to fetch products')
      return NextResponse.json({ error }, { status: productsUpstream.status })
    }

    const product = (productsPayload as BackendStoreProduct[]).find((item) => item.id === productId)

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if (product.isActive === false) {
      return NextResponse.json({ error: 'This product is no longer available' }, { status: 400 })
    }
    if (quantity > Number(product.stock ?? 0)) {
      return NextResponse.json({ error: `Insufficient stock. Available: ${Number(product.stock ?? 0)}` }, { status: 400 })
    }

    const unitPrice = Number(product.price ?? 0)
    const upstream = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ retailProductId: productId, quantity, unitPrice }],
        shippingAddress,
      }),
      cache: 'no-store',
    })

    const text = await upstream.text()
    const payload = text ? (JSON.parse(text) as BackendOrder) : {}

    if (!upstream.ok) {
      const error = payload.message || payload.error || 'Failed to create order'
      return NextResponse.json({ error }, { status: upstream.status })
    }

    const createdAt = payload.createdAt ?? new Date().toISOString()
    const updatedAt = payload.updatedAt ?? createdAt
    const order = {
      id: payload.id ?? '',
      buyerId: payload.buyerId ?? session.user.id,
      productId,
      quantity,
      totalPrice: Number(payload.totalAmount ?? unitPrice * quantity),
      status: payload.status ?? 'PENDING',
      shippingAddress: payload.shippingAddress ?? shippingAddress,
      phone,
      createdAt,
      updatedAt,
      buyer: {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email,
      },
      product: {
        id: product.id,
        sellerId: product.sellerId ?? '',
        name: product.title ?? '',
        category: product.category ?? '',
        price: unitPrice,
        stock: Math.max(0, Number(product.stock ?? 0) - quantity),
        description: product.description ?? null,
        imageUrl: null,
        isActive: product.isActive ?? true,
        createdAt: product.createdAt ?? createdAt,
        updatedAt: product.updatedAt ?? updatedAt,
      },
    }

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error('apps/web orders POST failed', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
