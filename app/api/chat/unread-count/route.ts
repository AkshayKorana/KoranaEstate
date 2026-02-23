import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deriveUserNames } from '@/lib/user-name'
import { isPrismaSchemaCompatibilityError } from '@/lib/prisma-compat'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ unreadCount: 0 }, { status: 200 })
    }

    const names = deriveUserNames({ name: session.user.name, email: session.user.email })
    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      update: { name: names.name ?? undefined, fullName: names.fullName },
      create: {
        email: session.user.email,
        name: names.name,
        fullName: names.fullName,
        passwordHash: 'oauth_user_no_password',
      },
    })

    let unreadCount = 0

    try {
      unreadCount = await prisma.message.count({
        where: {
          isRead: false,
          senderId: { not: user.id },
          conversation: {
            OR: [
              { buyerId: user.id },
              { sellerId: user.id },
            ],
          },
        },
      })
      // Also compute participant-based count and use the larger one for compatibility safety.
      const compatRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count
         FROM "Message" m
         JOIN "ConversationParticipant" cp
           ON cp."conversationId" = m."conversationId"
         WHERE cp."userId" = $1
           AND m."isRead" = false
           AND m."senderId" <> $1`,
        user.id,
      )
      unreadCount = Math.max(unreadCount, compatRows[0]?.count ?? 0)
    } catch (error) {
      if (!isPrismaSchemaCompatibilityError(error)) throw error

      // Compatibility mode for backend schema using ConversationParticipant join table.
      const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count
         FROM "Message" m
         JOIN "ConversationParticipant" cp
           ON cp."conversationId" = m."conversationId"
         WHERE cp."userId" = $1
           AND m."isRead" = false
           AND m."senderId" <> $1`,
        user.id,
      )
      unreadCount = rows[0]?.count ?? 0
    }

    return NextResponse.json({ unreadCount })
  } catch (error) {
    console.error('Error fetching unread message count:', error)
    return NextResponse.json({ unreadCount: 0, error: 'Failed to fetch unread count' }, { status: 200 })
  }
}
