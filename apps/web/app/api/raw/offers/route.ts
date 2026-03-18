import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

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

    return NextResponse.json({ offers: [] })
  } catch (error) {
    console.error('apps/web raw offers GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const upstream = await fetch(`${API_BASE}/marketplace/listings/${encodeURIComponent(listingId)}/bids`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amountPerKg: Number(offerPrice.toFixed(2)),
        quantityKg: Number(quantity.toFixed(2)),
        note: message,
      }),
      cache: 'no-store',
    })

    const text = await upstream.text()
    const payload = text ? JSON.parse(text) as {
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
    } : {}

    if (!upstream.ok) {
      const error = payload.message || payload.error || 'Failed to create offer'
      return NextResponse.json({ error }, { status: upstream.status })
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

    return NextResponse.json({ offer }, { status: 201 })
  } catch (error) {
    console.error('apps/web raw offers POST failed', error)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }
}
