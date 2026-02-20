import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/raw/search - Advanced search with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const commodity = searchParams.get('commodity')
    const location = searchParams.get('location')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const minQuantity = searchParams.get('minQuantity')
    const grade = searchParams.get('grade')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { isActive: true }

    if (commodity) {
      where.commodity = { contains: commodity, mode: 'insensitive' }
    }

    if (location) {
      where.location = { contains: location, mode: 'insensitive' }
    }

    if (grade) {
      where.grade = { contains: grade, mode: 'insensitive' }
    }

    if (minPrice || maxPrice) {
      where.pricePerKg = {}
      if (minPrice) where.pricePerKg.gte = parseFloat(minPrice)
      if (maxPrice) where.pricePerKg.lte = parseFloat(maxPrice)
    }

    if (minQuantity) {
      where.quantityKg = { gte: parseFloat(minQuantity) }
    }

    // Get total count for pagination
    const total = await prisma.rawListing.count({ where })

    const listings = await prisma.rawListing.findMany({
      where,
      include: {
        seller: {
          select: { id: true, name: true, email: true }
        },
        offers: {
          where: { status: 'PENDING' },
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    return NextResponse.json({
      listings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + listings.length < total
      }
    })
  } catch (error) {
    console.error('Error searching listings:', error)
    return NextResponse.json(
      { error: 'Failed to search listings' },
      { status: 500 }
    )
  }
}
