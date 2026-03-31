import { NextRequest, NextResponse } from 'next/server'
import { extractMessage, parseJsonSafely } from '@/app/lib/api-errors'
import { attachRefreshedSession, fetchWithAuthRetry } from '@/app/api/_lib/auth'

export const dynamic = 'force-dynamic'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

function getApiErrorMessage(payload: unknown, fallback: string) {
  return extractMessage(payload) || fallback
}

export async function GET(request: NextRequest) {
  try {
    const upstreamResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/marketplace/listings`,
      method: 'GET',
    })
    if ('errorResponse' in upstreamResult) {
      return upstreamResult.errorResponse
    }

    const response = NextResponse.json({ offers: [] })
    return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('apps/web raw offers GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const listingId = typeof body?.listingId === 'string' ? body.listingId : ''
    const offerPrice = Number(body?.offerPrice)
    const quantity = Number(body?.quantity)
    const message = typeof body?.message === 'string' ? body.message.trim() : null

    if (!listingId || !Number.isFinite(offerPrice) || !Number.isFinite(quantity)) {
      return NextResponse.json(
        { error: 'Missing required fields: listingId, offerPrice, quantity' },
        { status: 400 },
      )
    }

    const upstreamResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/marketplace/listings/${encodeURIComponent(listingId)}/bids`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amountPerKg: Number(offerPrice.toFixed(2)),
        quantityKg: Number(quantity.toFixed(2)),
        note: message,
      }),
    })
    if ('errorResponse' in upstreamResult) {
      return upstreamResult.errorResponse
    }

    const text = await upstreamResult.upstream.text()
    const payload = parseJsonSafely<{
      id?: string
      rawProductId?: string
      buyerId?: string
      amountPerKg?: number | string
      quantityKg?: number | string
      note?: string | null
      status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
      createdAt?: string
      updatedAt?: string
      message?: string
      error?: string
    }>(text) ?? {}

    if (!upstreamResult.upstream.ok) {
      const error = getApiErrorMessage(payload, 'Failed to create offer')
      const response = NextResponse.json({ error }, { status: upstreamResult.upstream.status })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const offer = {
      id: payload.id ?? '',
      listingId: payload.rawProductId ?? listingId,
      buyerId: payload.buyerId ?? '',
      offerPrice: Number(payload.amountPerKg ?? 0),
      quantity: Number(payload.quantityKg ?? 0),
      message: payload.note ?? null,
      status: payload.status ?? 'PENDING',
      createdAt: payload.createdAt ?? new Date(0).toISOString(),
      updatedAt: payload.updatedAt ?? payload.createdAt ?? new Date(0).toISOString(),
      listing: undefined,
      buyer: undefined,
    }

    const response = NextResponse.json({ offer }, { status: 201 })
    return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('apps/web raw offers POST failed', error)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }
}
