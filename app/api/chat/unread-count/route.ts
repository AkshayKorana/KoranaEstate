import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ unreadCount: 0 }, { status: 200 })
    }

    const user = await prisma.user.upsert({
      where: { email: session.user.email },
      update: { name: session.user.name ?? undefined },
      create: {
        email: session.user.email,
        name: session.user.name ?? null,
        passwordHash: 'oauth_user_no_password',
      },
    })

    const unreadCount = await prisma.message.count({
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

    return NextResponse.json({ unreadCount })
  } catch (error) {
    console.error('Error fetching unread message count:', error)
    return NextResponse.json({ unreadCount: 0, error: 'Failed to fetch unread count' }, { status: 500 })
  }
}
