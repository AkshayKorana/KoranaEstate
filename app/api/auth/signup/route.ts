import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function GET() {
  return NextResponse.json({ ok: true, route: 'api/auth/signup' }, { status: 200 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email is already registered.' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('Signup error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.toLowerCase().includes('readonly database') || message.toLowerCase().includes('attempt to write a readonly database')) {
      return NextResponse.json(
        {
          error: 'Database is read-only on this runtime.',
          detail: 'Ensure write permission for prisma/dev.db and prisma/ directory, and run app from a writable folder.',
        },
        { status: 500 }
      )
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'Email is already registered.' }, { status: 409 })
      }
      if (error.code === 'P2021') {
        return NextResponse.json(
          {
            error: 'Database schema is out of date.',
            detail: 'Run: npx prisma migrate dev && npx prisma generate',
          },
          { status: 500 }
        )
      }
    }
    return NextResponse.json(
      {
        error: 'Failed to create user.',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
  }
}
