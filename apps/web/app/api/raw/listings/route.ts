import { NextRequest, NextResponse } from 'next/server'
import { extractMessage, parseJsonSafely } from '@/app/lib/api-errors'
import { attachRefreshedSession, fetchWithAuthRetry } from '@/app/api/_lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0 // POST routes need dynamic; GET adds its own cache header

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

type BackendRawListing = {
  id: string
  sellerId?: string | null
  title?: string | null
  commodityName?: string | null
  grade?: string | null
  location?: string | null
  quantityKg?: number | string | null
  pricePerKg?: number | string | null
  description?: string | null
  isActive?: boolean | null
  createdAt?: string | null
  updatedAt?: string | null
  seller?: {
    id?: string
    fullName?: string | null
  } | null
}

function toRawListing(listing: BackendRawListing | null | undefined) {
  if (!listing?.id) {
    return null
  }

  const commodity = listing.commodityName ?? listing.title ?? ''
  const sellerName = listing.seller?.fullName ?? null

  return {
    id: listing.id,
    sellerId: listing.sellerId ?? listing.seller?.id ?? '',
    commodity,
    grade: listing.grade ?? null,
    quantityKg: Number(listing.quantityKg ?? 0),
    pricePerKg: Number(listing.pricePerKg ?? 0),
    location: listing.location ?? '',
    description: listing.description ?? null,
    isActive: listing.isActive ?? true,
    createdAt: listing.createdAt ?? new Date(0).toISOString(),
    updatedAt: listing.updatedAt ?? listing.createdAt ?? new Date(0).toISOString(),
    seller: listing.seller?.id
      ? {
          id: listing.seller.id,
          name: sellerName,
          email: '',
        }
      : undefined,
    offers: [],
  }
}

function toCommodityType(commodity: string) {
  return /cardamom|pepper/i.test(commodity) ? 'SPICE' : 'COFFEE'
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  return extractMessage(payload) || fallback
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commodity = searchParams.get('commodity')
    const location = searchParams.get('location')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const upstreamResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/marketplace/listings`,
      method: 'GET',
    })
    if ('errorResponse' in upstreamResult) {
      return upstreamResult.errorResponse
    }

    const text = await upstreamResult.upstream.text()
    const payload = parseJsonSafely<BackendRawListing[] | { message?: string; error?: string }>(text) ?? []

    if (!upstreamResult.upstream.ok) {
      const error = Array.isArray(payload) ? 'Failed to fetch listings' : getApiErrorMessage(payload, 'Failed to fetch listings')
      const response = NextResponse.json({ error }, { status: upstreamResult.upstream.status })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50
    const listings = (Array.isArray(payload) ? payload : [])
      .map(toRawListing)
      .filter((listing): listing is NonNullable<ReturnType<typeof toRawListing>> => Boolean(listing))
      .filter((listing) => (!commodity || listing.commodity === commodity) && (!location || listing.location.toLowerCase().includes(location.toLowerCase())))
      .slice(0, normalizedLimit)

    const response = NextResponse.json(
      { listings },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    )
    return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('apps/web raw listings GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const commodity = typeof body?.commodity === 'string' ? body.commodity.trim() : ''
    const grade = typeof body?.grade === 'string' ? body.grade.trim() : null
    const location = typeof body?.location === 'string' ? body.location.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : null
    const quantityKg = Number(body?.quantityKg)
    const pricePerKg = Number(body?.pricePerKg)

    if (!commodity || !location || !Number.isFinite(quantityKg) || !Number.isFinite(pricePerKg)) {
      return NextResponse.json(
        { error: 'Missing required fields: commodity, quantityKg, pricePerKg, location' },
        { status: 400 },
      )
    }

    if (quantityKg <= 0 || pricePerKg <= 0) {
      return NextResponse.json({ error: 'Quantity and price must be positive' }, { status: 400 })
    }

    const upstreamResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/marketplace/listings`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: commodity,
        commodityType: toCommodityType(commodity),
        commodityName: commodity,
        grade,
        location,
        quantityKg: Number(quantityKg.toFixed(2)),
        pricePerKg: Number(pricePerKg.toFixed(2)),
        description,
      }),
    })
    if ('errorResponse' in upstreamResult) {
      return upstreamResult.errorResponse
    }

    const text = await upstreamResult.upstream.text()
    const payload = parseJsonSafely<BackendRawListing | { message?: string; error?: string }>(text) ?? {}

    if (!upstreamResult.upstream.ok) {
      const error = upstreamResult.upstream.status === 403
        ? 'Only seller accounts can create raw marketplace listings.'
        : getApiErrorMessage(payload, 'Failed to create listing')
      const response = NextResponse.json({ error }, { status: upstreamResult.upstream.status })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const listing = toRawListing(payload as BackendRawListing)
    if (!listing) {
      const response = NextResponse.json({ error: 'Created listing response was incomplete' }, { status: 502 })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const response = NextResponse.json({ listing }, { status: 201 })
    return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('apps/web raw listings POST failed', error)
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 })
  }
}
