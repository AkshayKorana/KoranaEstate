import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/raw/offers - Create new offer (authenticated buyers)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { listingId, offerPrice, quantity, message } = body

    if (!listingId || !offerPrice || !quantity) {
      return NextResponse.json(
        { error: 'Missing required fields: listingId, offerPrice, quantity' },
        { status: 400 }
      )
    }

    // Verify listing exists and is active
    const listing = await prisma.rawListing.findUnique({
      where: { id: listingId }
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (!listing.isActive) {
      return NextResponse.json(
        { error: 'This listing is no longer active' },
        { status: 400 }
      )
    }

    if (listing.sellerId === user.id) {
      return NextResponse.json(
        { error: 'You cannot make an offer on your own listing' },
        { status: 400 }
      )
    }

    if (parseFloat(quantity) > listing.quantityKg) {
      return NextResponse.json(
        { error: `Requested quantity exceeds available stock (${listing.quantityKg} kg)` },
        { status: 400 }
      )
    }

    const offer = await prisma.rawOffer.create({
      data: {
        listingId,
        buyerId: user.id,
        offerPrice: parseFloat(offerPrice),
        quantity: parseFloat(quantity),
        message
      },
      include: {
        buyer: {
          select: { id: true, name: true, email: true }
        },
        listing: {
          include: {
            seller: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    })

    return NextResponse.json({ offer }, { status: 201 })
  } catch (error) {
    console.error('Error creating offer:', error)
    return NextResponse.json(
      { error: 'Failed to create offer' },
      { status: 500 }
    )
  }
}

// GET /api/raw/offers - Get user's offers (as buyer or seller)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') // 'buyer' or 'seller'

    let offers

    if (role === 'seller') {
      // Get offers on my listings
      offers = await prisma.rawOffer.findMany({
        where: {
          listing: { sellerId: user.id }
        },
        include: {
          buyer: {
            select: { id: true, name: true, email: true }
          },
          listing: true
        },
        orderBy: { createdAt: 'desc' }
      })
    } else {
      // Get my offers as buyer
      offers = await prisma.rawOffer.findMany({
        where: { buyerId: user.id },
        include: {
          listing: {
            include: {
              seller: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    }

    return NextResponse.json({ offers })
  } catch (error) {
    console.error('Error fetching offers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch offers' },
      { status: 500 }
    )
  }
}
