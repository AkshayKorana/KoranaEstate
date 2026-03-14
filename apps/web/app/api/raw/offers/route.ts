import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSessionUser } from '@/app/api/_session-user'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    const offers = await prisma.rawOffer.findMany({
      where:
        role === 'seller'
          ? {
              listing: { sellerId: user.id },
            }
          : {
              buyerId: user.id,
            },
      include: {
        buyer: {
          select: { id: true, name: true, email: true },
        },
        listing: {
          include: {
            seller: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ offers })
  } catch (error) {
    console.error('apps/web raw offers GET failed', error)
    return NextResponse.json({ error: 'Failed to fetch offers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!user) {
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

    const listing = await prisma.rawListing.findUnique({ where: { id: listingId } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    if (!listing.isActive) {
      return NextResponse.json({ error: 'This listing is no longer active' }, { status: 400 })
    }
    if (listing.sellerId === user.id) {
      return NextResponse.json({ error: 'You cannot make an offer on your own listing' }, { status: 400 })
    }
    if (quantity > listing.quantityKg) {
      return NextResponse.json(
        { error: `Requested quantity exceeds available stock (${listing.quantityKg} kg)` },
        { status: 400 },
      )
    }

    const offer = await prisma.rawOffer.create({
      data: {
        listingId,
        buyerId: user.id,
        offerPrice: Number(offerPrice.toFixed(2)),
        quantity: Number(quantity.toFixed(2)),
        message,
      },
      include: {
        buyer: {
          select: { id: true, name: true, email: true },
        },
        listing: {
          include: {
            seller: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    })

    return NextResponse.json({ offer }, { status: 201 })
  } catch (error) {
    console.error('apps/web raw offers POST failed', error)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }
}
