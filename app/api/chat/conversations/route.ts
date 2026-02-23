import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deriveUserNames } from '@/lib/user-name'
import { isPrismaSchemaCompatibilityError } from '@/lib/prisma-compat'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

// GET /api/chat/conversations - Get user's conversations
export async function GET() {
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

    let conversations: Array<{
      id: string
      buyerId: string
      sellerId: string
      createdAt: Date
      lastMessageAt: Date
      buyer: { id: string; name: string | null; email: string }
      seller: { id: string; name: string | null; email: string }
      messages: Array<{ id: string; content: string; createdAt: Date; senderId: string }>
    }>

    try {
      conversations = await prisma.conversation.findMany({
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
    } catch (error) {
      if (!isPrismaSchemaCompatibilityError(error)) throw error

      // Compatibility mode for backend schema: Conversation + ConversationParticipant.
      const rows = await prisma.$queryRawUnsafe<Array<{
        id: string
        createdAt: Date
        lastMessageAt: Date
        otherId: string | null
        otherName: string | null
        otherEmail: string | null
        messageId: string | null
        messageContent: string | null
        messageCreatedAt: Date | null
        messageSenderId: string | null
      }>>(
        `SELECT
           c."id" AS "id",
           c."createdAt" AS "createdAt",
           c."updatedAt" AS "lastMessageAt",
           uo."id" AS "otherId",
           COALESCE(uo."name", uo."fullName") AS "otherName",
           uo."email" AS "otherEmail",
           lm."id" AS "messageId",
           lm."content" AS "messageContent",
           lm."createdAt" AS "messageCreatedAt",
           lm."senderId" AS "messageSenderId"
         FROM "Conversation" c
         JOIN "ConversationParticipant" cps
           ON cps."conversationId" = c."id" AND cps."userId" = $1
         LEFT JOIN "ConversationParticipant" cpo
           ON cpo."conversationId" = c."id" AND cpo."userId" <> $1
         LEFT JOIN "User" uo
           ON uo."id" = cpo."userId"
         LEFT JOIN LATERAL (
           SELECT m."id", m."content", m."createdAt", m."senderId"
           FROM "Message" m
           WHERE m."conversationId" = c."id"
           ORDER BY m."createdAt" DESC
           LIMIT 1
         ) lm ON TRUE
         ORDER BY c."updatedAt" DESC`,
        user.id,
      )

      conversations = rows.map((row) => ({
        id: row.id,
        buyerId: user.id,
        sellerId: row.otherId ?? user.id,
        createdAt: row.createdAt,
        lastMessageAt: row.lastMessageAt,
        buyer: {
          id: user.id,
          name: user.name ?? user.fullName,
          email: user.email,
        },
        seller: {
          id: row.otherId ?? user.id,
          name: row.otherName,
          email: row.otherEmail ?? user.email,
        },
        messages: row.messageId
          ? [
              {
                id: row.messageId,
                content: row.messageContent ?? '',
                createdAt: row.messageCreatedAt ?? row.lastMessageAt,
                senderId: row.messageSenderId ?? user.id,
              },
            ]
          : [],
      }))
    }

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

    // Check if target seller exists
    const sellerUser = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { id: true, name: true, fullName: true, email: true },
    })
    if (!sellerUser) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    let conversation: {
      id: string
      buyerId: string
      sellerId: string
      createdAt: Date
      lastMessageAt: Date
      buyer: { id: string; name: string | null; email: string }
      seller: { id: string; name: string | null; email: string }
    }
    let isNewConversation = false

    try {
      // Standard web schema path.
      let existing = await prisma.conversation.findFirst({
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

      if (!existing) {
        isNewConversation = true
        existing = await prisma.conversation.create({
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

      conversation = existing
    } catch (error) {
      if (!isPrismaSchemaCompatibilityError(error)) throw error

      // Compatibility mode for backend schema using participants.
      const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string; createdAt: Date; updatedAt: Date }>>(
        `SELECT c."id", c."createdAt", c."updatedAt"
         FROM "Conversation" c
         JOIN "ConversationParticipant" cp1
           ON cp1."conversationId" = c."id" AND cp1."userId" = $1
         JOIN "ConversationParticipant" cp2
           ON cp2."conversationId" = c."id" AND cp2."userId" = $2
         LIMIT 1`,
        user.id,
        sellerId,
      )

      let convoId: string
      let convoCreatedAt: Date
      let convoUpdatedAt: Date

      if (existingRows.length > 0) {
        convoId = existingRows[0].id
        convoCreatedAt = existingRows[0].createdAt
        convoUpdatedAt = existingRows[0].updatedAt
      } else {
        isNewConversation = true
        const convoIdGenerated = randomUUID()
        const inserted = await prisma.$queryRawUnsafe<Array<{ id: string; createdAt: Date; updatedAt: Date }>>(
          `INSERT INTO "Conversation" ("id","createdAt","updatedAt")
           VALUES ($1, NOW(), NOW())
           RETURNING "id","createdAt","updatedAt"`,
          convoIdGenerated,
        )
        convoId = inserted[0]?.id ?? convoIdGenerated
        convoCreatedAt = inserted[0].createdAt
        convoUpdatedAt = inserted[0].updatedAt

        await prisma.$queryRawUnsafe(
          `INSERT INTO "ConversationParticipant" ("id","conversationId","userId","createdAt")
           VALUES ($1,$2,$3,NOW()),($4,$2,$5,NOW())`,
          randomUUID(),
          convoId,
          user.id,
          randomUUID(),
          sellerId,
        )
      }

      conversation = {
        id: convoId,
        buyerId: user.id,
        sellerId,
        createdAt: convoCreatedAt,
        lastMessageAt: convoUpdatedAt,
        buyer: { id: user.id, name: user.name ?? user.fullName, email: user.email },
        seller: {
          id: sellerUser.id,
          name: sellerUser.name ?? sellerUser.fullName,
          email: sellerUser.email,
        },
      }
    }

    const content = typeof initialMessage === 'string' ? initialMessage.trim() : ''
    if (content.length > 0) {
      try {
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
      } catch (error) {
        if (!isPrismaSchemaCompatibilityError(error)) throw error
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `INSERT INTO "Message"
              ("id","conversationId","senderId","content","isRead","createdAt","updatedAt")
             VALUES
              ($1,$2,$3,$4,false,NOW(),NOW())`,
            randomUUID(),
            conversation.id,
            user.id,
            content,
          )
          await tx.$executeRawUnsafe(
            `UPDATE "Conversation" SET "updatedAt" = NOW() WHERE "id" = $1`,
            conversation.id,
          )
        })
      }
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
