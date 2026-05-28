import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deriveUserNames } from '@/lib/user-name'
import { isPrismaSchemaCompatibilityError } from '@/lib/prisma-compat'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0 // POST routes need dynamic; GET adds its own cache header

// GET /api/products - Get all active products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { isActive: true }
    if (category) where.category = category

    let total = 0
    let products: Array<{
      id: string
      sellerId: string
      name: string
      category: string
      price: number
      stock: number
      description: string | null
      imageUrl: string | null
      isActive: boolean
      createdAt: Date
      updatedAt: Date
      seller: { id: string; name: string | null; email: string }
    }> = []

    try {
      total = await prisma.product.count({ where })

      products = await prisma.product.findMany({
        where,
        include: {
          seller: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      })
    } catch (error) {
      if (!isPrismaSchemaCompatibilityError(error)) throw error

      // Compatibility mode: read from backend RetailProduct table when Product is unavailable.
      const countRows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
        `SELECT COUNT(*)::int AS c
         FROM "RetailProduct" rp
         WHERE rp."isActive" = true
           AND rp."deletedAt" IS NULL
           AND ($1::text IS NULL OR rp."category" = $1)`,
        category,
      )
      total = countRows[0]?.c ?? 0

      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string
          sellerId: string
          name: string
          category: string
          price: number
          stock: number
          description: string | null
          imageUrl: string | null
          isActive: boolean
          createdAt: Date
          updatedAt: Date
          sellerIdRef: string
          sellerName: string | null
          sellerEmail: string
        }>
      >(
        `SELECT
           rp."id" AS "id",
           rp."sellerId" AS "sellerId",
           rp."title" AS "name",
           rp."category" AS "category",
           rp."price"::double precision AS "price",
           rp."stock" AS "stock",
           rp."description" AS "description",
           NULL::text AS "imageUrl",
           rp."isActive" AS "isActive",
           rp."createdAt" AS "createdAt",
           rp."updatedAt" AS "updatedAt",
           u."id" AS "sellerIdRef",
           COALESCE(u."name", u."fullName") AS "sellerName",
           u."email" AS "sellerEmail"
         FROM "RetailProduct" rp
         JOIN "User" u ON u."id" = rp."sellerId"
         WHERE rp."isActive" = true
           AND rp."deletedAt" IS NULL
           AND ($1::text IS NULL OR rp."category" = $1)
         ORDER BY rp."createdAt" DESC
         LIMIT $2 OFFSET $3`,
        category,
        limit,
        offset,
      )

      products = rows.map((row) => ({
        id: row.id,
        sellerId: row.sellerId,
        name: row.name,
        category: row.category,
        price: Number(row.price),
        stock: row.stock,
        description: row.description,
        imageUrl: row.imageUrl,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        seller: {
          id: row.sellerIdRef,
          name: row.sellerName,
          email: row.sellerEmail,
        },
      }))
    }

    return NextResponse.json(
      { products, pagination: { total, limit, offset, hasMore: offset + products.length < total } },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    )
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create new product (authenticated sellers)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const names = deriveUserNames({ name: session.user.name, email: session.user.email })
    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      update: {
        name: names.name ?? undefined,
        fullName: names.fullName,
      },
      create: {
        email: session.user.email,
        name: names.name,
        fullName: names.fullName,
        // Placeholder for non-credentials users; credentials signup sets real hash.
        passwordHash: 'oauth_user_no_password',
      },
    })

    const body = await request.json()
    const { name, category, price, stock, description, imageUrl } = body
    const nameStr = typeof name === 'string' ? name.trim() : ''
    const categoryStr = typeof category === 'string' ? category.trim() : ''
    const priceNum = Number(price)
    const stockNum = Number(stock)

    // Validation
    if (!nameStr || !categoryStr || !Number.isFinite(priceNum) || !Number.isFinite(stockNum)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, price, stock' },
        { status: 400 }
      )
    }

    if (priceNum <= 0 || stockNum < 0) {
      return NextResponse.json(
        { error: 'Price must be positive and stock cannot be negative' },
        { status: 400 }
      )
    }

    let product: {
      id: string
      sellerId: string
      name: string
      category: string
      price: number
      stock: number
      description: string | null
      imageUrl: string | null
      isActive: boolean
      createdAt: Date
      updatedAt: Date
      seller: { id: string; name: string | null; email: string }
    }

    try {
      product = await prisma.product.create({
        data: {
          sellerId: user.id,
          name: nameStr,
          category: categoryStr,
          price: Number(priceNum.toFixed(2)),
          stock: Math.floor(stockNum),
          description,
          imageUrl
        },
        include: {
          seller: {
            select: { id: true, name: true, email: true }
          }
        }
      })
    } catch (error) {
      if (!isPrismaSchemaCompatibilityError(error)) throw error

      const id = randomUUID()
      const now = new Date()
      await prisma.$queryRawUnsafe(
        `INSERT INTO "RetailProduct"
          ("id","sellerId","title","category","price","stock","description","isActive","createdAt","updatedAt")
         VALUES
          ($1,$2,$3,$4,$5::numeric,$6,$7,true,$8,$8)`,
        id,
        user.id,
        nameStr,
        categoryStr,
        Number(priceNum.toFixed(2)),
        Math.floor(stockNum),
        typeof description === 'string' ? description : null,
        now,
      )

      product = {
        id,
        sellerId: user.id,
        name: nameStr,
        category: categoryStr,
        price: Number(priceNum.toFixed(2)),
        stock: Math.floor(stockNum),
        description: typeof description === 'string' ? description : null,
        imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        seller: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      }
    }

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
