import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/estate/listings/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const listing = await prisma.estateListing.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({ listing })
  } catch (error) {
    console.error('Error fetching estate listing:', error)
    return NextResponse.json({ error: 'Failed to fetch estate listing' }, { status: 500 })
  }
}

// PUT /api/estate/listings/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const listing = await prisma.estateListing.findUnique({ where: { id } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.sellerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You can only edit your own listing' }, { status: 403 })
    }

    const body = await request.json()
    const updates: {
      title?: string
      category?: string
      subcategory?: string | null
      listingType?: string
      unit?: string
      location?: string
      description?: string | null
      contactPhone?: string | null
      isActive?: boolean
      price?: number
      quantity?: number | null
    } = {}

    if (body.title !== undefined) updates.title = String(body.title).trim()
    if (body.category !== undefined) updates.category = String(body.category).trim()
    if (body.subcategory !== undefined) updates.subcategory = body.subcategory ? String(body.subcategory).trim() : null
    if (body.listingType !== undefined) updates.listingType = String(body.listingType).trim()
    if (body.unit !== undefined) updates.unit = String(body.unit).trim()
    if (body.location !== undefined) updates.location = String(body.location).trim()
    if (body.description !== undefined) updates.description = body.description ? String(body.description).trim() : null
    if (body.contactPhone !== undefined) updates.contactPhone = body.contactPhone ? String(body.contactPhone).trim() : null
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive)

    if (body.price !== undefined) {
      const price = Number(body.price)
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: 'Price must be positive' }, { status: 400 })
      }
      updates.price = Number(price.toFixed(2))
    }

    if (body.quantity !== undefined) {
      if (body.quantity === null || body.quantity === '') {
        updates.quantity = null
      } else {
        const qty = Number(body.quantity)
        if (!Number.isFinite(qty) || qty < 0) {
          return NextResponse.json({ error: 'Quantity cannot be negative' }, { status: 400 })
        }
        updates.quantity = Number(qty.toFixed(2))
      }
    }

    const updated = await prisma.estateListing.update({
      where: { id },
      data: updates,
      include: {
        seller: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({ listing: updated })
  } catch (error) {
    console.error('Error updating estate listing:', error)
    return NextResponse.json({ error: 'Failed to update estate listing' }, { status: 500 })
  }
}

// DELETE /api/estate/listings/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const listing = await prisma.estateListing.findUnique({ where: { id } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.sellerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own listing' }, { status: 403 })
    }

    await prisma.estateListing.delete({ where: { id } })
    return NextResponse.json({ message: 'Listing deleted successfully' })
  } catch (error) {
    console.error('Error deleting estate listing:', error)
    return NextResponse.json({ error: 'Failed to delete estate listing' }, { status: 500 })
  }
}
