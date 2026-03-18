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

function toProduct(product: BackendStoreProduct) {
  return {
    id: product.id,
    sellerId: product.sellerId ?? '',
    name: product.title ?? '',
    category: product.category ?? '',
    price: Number(product.price ?? 0),
    stock: Number(product.stock ?? 0),
    description: product.description ?? null,
    imageUrl: null,
    isActive: product.isActive ?? true,
    createdAt: product.createdAt ?? new Date(0).toISOString(),
    updatedAt: product.updatedAt ?? product.createdAt ?? new Date(0).toISOString(),
    seller: undefined,
  }
}

async function getAccessToken() {
  const session = await getServerSession(authOptions)
  return session?.accessToken ?? null
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const upstream = await fetch(`${API_BASE}/store/products`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    })

    const text = await upstream.text()
    const payload = text ? (JSON.parse(text) as BackendStoreProduct[]) : []

    if (!upstream.ok) {
      const error = Array.isArray(payload) ? 'Failed to fetch products' : ((payload as { message?: string; error?: string }).message || (payload as { error?: string }).error || 'Failed to fetch products')
      return NextResponse.json({ error }, { status: upstream.status })
    }

    const filteredProducts = payload
      .map(toProduct)
      .filter((product) => !category || product.category === category)
    const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50
    const normalizedOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0
    const products = filteredProducts.slice(normalizedOffset, normalizedOffset + normalizedLimit)
    const total = filteredProducts.length

    return NextResponse.json({
      products,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + products.length < total,
      },
    })
  } catch (error) {
    console.error('apps/web products GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const upstream = await fetch(`${API_BASE}/store/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: name,
        category,
        price: Number(price.toFixed(2)),
        stock: Math.floor(stock),
        description,
      }),
      cache: 'no-store',
    })

    const text = await upstream.text()
    const payload = text ? (JSON.parse(text) as BackendStoreProduct | { message?: string; error?: string }) : {}

    if (!upstream.ok) {
      const error = (payload as { message?: string; error?: string }).message || (payload as { error?: string }).error || 'Failed to create product'
      return NextResponse.json({ error }, { status: upstream.status })
    }

    return NextResponse.json({ product: toProduct(payload as BackendStoreProduct) }, { status: 201 })
  } catch (error) {
    console.error('apps/web products POST failed', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
