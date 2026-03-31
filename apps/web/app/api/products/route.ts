import { NextRequest, NextResponse } from 'next/server'
import { extractMessage, parseJsonSafely } from '@/app/lib/api-errors'
import { attachRefreshedSession, fetchWithAuthRetry } from '@/app/api/_lib/auth'

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

function toProduct(product: BackendStoreProduct | null | undefined) {
  if (!product?.id) {
    return null
  }

  return {
    id: product.id,
    sellerId: product.sellerId ?? '',
    name: product.title ?? '',
    category: product.category ?? '',
    price: Number(product.price ?? 0),
    stock: Number(product.stock ?? 0),
    description: product.description ?? null,
    imageUrl: product.imageUrl ?? null,
    isActive: product.isActive ?? true,
    createdAt: product.createdAt ?? new Date(0).toISOString(),
    updatedAt: product.updatedAt ?? product.createdAt ?? new Date(0).toISOString(),
    seller: product.seller?.id
      ? {
          id: product.seller.id,
          name: product.seller.fullName ?? null,
          email: '',
        }
      : undefined,
  }
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  return extractMessage(payload) || fallback
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const upstreamResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/store/products`,
      method: 'GET',
    })
    if ('errorResponse' in upstreamResult) {
      return upstreamResult.errorResponse
    }

    const text = await upstreamResult.upstream.text()
    const payload = parseJsonSafely<BackendStoreProduct[] | { message?: string; error?: string }>(text) ?? []

    if (!upstreamResult.upstream.ok) {
      const error = Array.isArray(payload) ? 'Failed to fetch products' : getApiErrorMessage(payload, 'Failed to fetch products')
      const response = NextResponse.json({ error }, { status: upstreamResult.upstream.status })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const filteredProducts = (Array.isArray(payload) ? payload : [])
      .map(toProduct)
      .filter((product): product is NonNullable<ReturnType<typeof toProduct>> => Boolean(product))
      .filter((product) => !category || product.category === category)
    const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50
    const normalizedOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0
    const products = filteredProducts.slice(normalizedOffset, normalizedOffset + normalizedLimit)
    const total = filteredProducts.length

    const response = NextResponse.json({
      products,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + products.length < total,
      },
    })
    return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('apps/web products GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const category = typeof body?.category === 'string' ? body.category.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : null
    const price = Number(body?.price)
    const stock = Number(body?.stock)

    if (!name || !category || !Number.isFinite(price) || !Number.isFinite(stock)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, price, stock' },
        { status: 400 },
      )
    }

    if (price <= 0 || stock < 0) {
      return NextResponse.json({ error: 'Price must be positive and stock cannot be negative' }, { status: 400 })
    }

    const upstreamResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/store/products`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: name,
        category,
        imageUrl: typeof body?.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null,
        price: Number(price.toFixed(2)),
        stock: Math.floor(stock),
        description,
      }),
    })
    if ('errorResponse' in upstreamResult) {
      return upstreamResult.errorResponse
    }

    const text = await upstreamResult.upstream.text()
    const payload = parseJsonSafely<BackendStoreProduct | { message?: string; error?: string }>(text) ?? {}

    if (!upstreamResult.upstream.ok) {
      const error = upstreamResult.upstream.status === 403
        ? 'Only seller accounts can add store products.'
        : getApiErrorMessage(payload, 'Failed to create product')
      const response = NextResponse.json({ error }, { status: upstreamResult.upstream.status })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const product = toProduct(payload as BackendStoreProduct)
    if (!product) {
      const response = NextResponse.json({ error: 'Created product response was incomplete' }, { status: 502 })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const response = NextResponse.json({ product }, { status: 201 })
    return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('apps/web products POST failed', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
