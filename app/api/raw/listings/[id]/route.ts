import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/raw/listings/[id] - Get single listing
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listing = await prisma.rawListing.findUnique({
      where: { id: params.id },
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        },
        offers: {
          include: {
            buyer: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({ listing })
  } catch (error) {
    console.error('Error fetching listing:', error)
    return NextResponse.json(
      { error: 'Failed to fetch listing' },
      { status: 500 }
    )
  }
}

// PUT /api/raw/listings/[id] - Update listing (owner only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const listing = await prisma.rawListing.findUnique({
      where: { id: params.id }
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.sellerId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit your own listings' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updates: any = {}

    if (body.grade !== undefined) updates.grade = body.grade
    if (body.quantityKg !== undefined) {
      const qty = parseFloat(body.quantityKg)
      if (qty <= 0) {
        return NextResponse.json(
          { error: 'Quantity must be positive' },
          { status: 400 }
        )
      }
      updates.quantityKg = qty
    }
    if (body.pricePerKg !== undefined) {
      const price = parseFloat(body.pricePerKg)
      if (price <= 0) {
        return NextResponse.json(
          { error: 'Price must be positive' },
          { status: 400 }
        )
      }
      updates.pricePerKg = price
    }
    if (body.location !== undefined) updates.location = body.location
    if (body.description !== undefined) updates.description = body.description
    if (body.isActive !== undefined) updates.isActive = body.isActive

    const updated = await prisma.rawListing.update({
      where: { id: params.id },
      data: updates,
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json({ listing: updated })
  } catch (error) {
    console.error('Error updating listing:', error)
    return NextResponse.json(
      { error: 'Failed to update listing' },
      { status: 500 }
    )
  }
}

// DELETE /api/raw/listings/[id] - Delete listing (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const listing = await prisma.rawListing.findUnique({
      where: { id: params.id }
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.sellerId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own listings' },
        { status: 403 }
      )
    }

    await prisma.rawListing.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Listing deleted successfully' })
  } catch (error) {
    console.error('Error deleting listing:', error)
    return NextResponse.json(
      { error: 'Failed to delete listing' },
      { status: 500 }
    )
  }
}
