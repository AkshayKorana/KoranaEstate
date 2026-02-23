import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deriveUserNames } from '@/lib/user-name'
import { isPrismaSchemaCompatibilityError } from '@/lib/prisma-compat'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

// GET /api/chat/messages - Get messages for a conversation
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: conversationId' },
        { status: 400 }
      )
    }

    let isMember = false

    try {
      // Web schema membership path.
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      })

      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        )
      }

      isMember = conversation.buyerId === user.id || conversation.sellerId === user.id
    } catch (error) {
      if (!isPrismaSchemaCompatibilityError(error)) throw error

      // Backend schema membership path.
      const rows = await prisma.$queryRawUnsafe<Array<{ exists: number }>>(
        `SELECT 1::int AS exists
         FROM "ConversationParticipant"
         WHERE "conversationId" = $1 AND "userId" = $2
         LIMIT 1`,
        conversationId,
        user.id,
      )
      isMember = rows.length > 0
    }

    if (!isMember) {
      return NextResponse.json(
        { error: 'Forbidden: You are not part of this conversation' },
        { status: 403 }
      )
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Mark messages as read for the current user
    await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        isRead: false
      },
      data: { isRead: true }
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

// POST /api/chat/messages - Send a message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const body = await request.json()
    const { conversationId, content } = body

    if (!conversationId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationId, content' },
        { status: 400 }
      )
    }

    let isMember = false

    try {
      // Web schema membership path.
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      })

      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        )
      }

      isMember = conversation.buyerId === user.id || conversation.sellerId === user.id
    } catch (error) {
      if (!isPrismaSchemaCompatibilityError(error)) throw error

      // Backend schema membership path.
      const rows = await prisma.$queryRawUnsafe<Array<{ exists: number }>>(
        `SELECT 1::int AS exists
         FROM "ConversationParticipant"
         WHERE "conversationId" = $1 AND "userId" = $2
         LIMIT 1`,
        conversationId,
        user.id,
      )
      isMember = rows.length > 0
    }

    if (!isMember) {
      return NextResponse.json(
        { error: 'Forbidden: You are not part of this conversation' },
        { status: 403 }
      )
    }

    // Create message and update conversation timestamp in transaction
    let message
    try {
      message = await prisma.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            conversationId,
            senderId: user.id,
            content
          },
          include: {
            sender: {
              select: { id: true, name: true, email: true }
            }
          }
        })

        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: new Date() }
        })

        return msg
      })
    } catch (error) {
      if (!isPrismaSchemaCompatibilityError(error)) throw error

      message = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO "Message"
            ("id","conversationId","senderId","content","isRead","createdAt","updatedAt")
           VALUES
            ($1,$2,$3,$4,false,NOW(),NOW())`,
          randomUUID(),
          conversationId,
          user.id,
          content,
        )

        const msgRows = await tx.$queryRawUnsafe<Array<{
          id: string
          conversationId: string
          senderId: string
          content: string
          isRead: boolean
          createdAt: Date
          senderName: string | null
          senderEmail: string
        }>>(
          `SELECT
             m."id",
             m."conversationId",
             m."senderId",
             m."content",
             m."isRead",
             m."createdAt",
             COALESCE(u."name", u."fullName") AS "senderName",
             u."email" AS "senderEmail"
           FROM "Message" m
           JOIN "User" u ON u."id" = m."senderId"
           WHERE m."conversationId" = $1
           ORDER BY m."createdAt" DESC
           LIMIT 1`,
          conversationId,
        )
        const row = msgRows[0]
        const msg = {
          id: row.id,
          conversationId: row.conversationId,
          senderId: row.senderId,
          content: row.content,
          isRead: row.isRead,
          createdAt: row.createdAt,
          sender: {
            id: row.senderId,
            name: row.senderName,
            email: row.senderEmail,
          },
        }

        await tx.$executeRawUnsafe(
          `UPDATE "Conversation" SET "updatedAt" = NOW() WHERE "id" = $1`,
          conversationId,
        )

        return msg
      })
    }

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
