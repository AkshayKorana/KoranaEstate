import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/chat/conversations - Get user's conversations
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { buyerId: user.id },
          { sellerId: user.id }
        ]
      },
      include: {
        buyer: {
          select: { id: true, name: true, email: true }
        },
        seller: {
          select: { id: true, name: true, email: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    })

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

// POST /api/chat/conversations - Create or get conversation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const body = await request.json()
    const { sellerId, initialMessage } = body

    if (!sellerId) {
      return NextResponse.json(
        { error: 'Missing required field: sellerId' },
        { status: 400 }
      )
    }

    if (sellerId === user.id) {
      return NextResponse.json(
        { error: 'Cannot create conversation with yourself' },
        { status: 400 }
      )
    }

    // Check if conversation already exists
    let conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { buyerId: user.id, sellerId },
          { buyerId: sellerId, sellerId: user.id }
        ]
      },
      include: {
        buyer: {
          select: { id: true, name: true, email: true }
        },
        seller: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    let isNewConversation = false
    if (!conversation) {
      isNewConversation = true
      conversation = await prisma.conversation.create({
        data: {
          buyerId: user.id,
          sellerId
        },
        include: {
          buyer: {
            select: { id: true, name: true, email: true }
          },
          seller: {
            select: { id: true, name: true, email: true }
          }
        }
      })
    }

    const content = typeof initialMessage === 'string' ? initialMessage.trim() : ''
    if (content.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: user.id,
            content,
          },
        })
        await tx.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        })
      })
    }

    return NextResponse.json({ conversation }, { status: isNewConversation ? 201 : 200 })
  } catch (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}
