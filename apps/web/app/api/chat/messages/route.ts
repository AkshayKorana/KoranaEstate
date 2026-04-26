import { NextRequest } from 'next/server'
import {
  buildChatErrorResponse,
  finalizeProxyResponse,
  getApiBaseUrl,
  proxyChatRequest,
} from '../_lib'
import { ADMIN_EMAILS } from '@/lib/auth'
import { sendMessageToAdminNotification, sendMessageReplyNotification } from '@/lib/email'

const API_BASE = getApiBaseUrl()

const SITE_URL = (process.env.NEXTAUTH_URL ?? 'https://korana-estate.vercel.app').replace(/\/$/, '')

type ConversationParticipant = {
  userId?: string
  user?: { id?: string; fullName?: string | null; role?: string | null; email?: string | null }
}

async function sendChatEmailNotification(
  senderEmail: string,
  senderName: string,
  senderRole: string,
  conversationId: string,
  messageContent: string,
  accessToken: string,
) {
  try {
    const conversationUrl = `${SITE_URL}/messages?conversationId=${encodeURIComponent(conversationId)}`
    const notifInput = { senderName, messageContent, conversationUrl, conversationId }

    if (senderRole !== 'ADMIN') {
      // Buyer → Admin: email the admin
      const adminEmail = Array.from(ADMIN_EMAILS)[0]
      if (adminEmail) {
        const result = await sendMessageToAdminNotification(adminEmail, notifInput)
        if (!result.ok) console.error('[CHAT EMAIL] Failed to notify admin:', result.error)
      }
      return
    }

    // Admin → Buyer: look up the conversation to find buyer email
    const convRes = await fetch(`${API_BASE}/chat/conversations`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!convRes.ok) {
      console.error('[CHAT EMAIL] Could not fetch conversations for email lookup:', convRes.status)
      return
    }

    const convData = (await convRes.json().catch(() => null)) as ConversationParticipant[] | { conversations?: ConversationParticipant[] } | null
    const conversations = Array.isArray(convData)
      ? convData
      : Array.isArray((convData as { conversations?: unknown[] })?.conversations)
        ? ((convData as { conversations?: ConversationParticipant[] }).conversations ?? [])
        : []

    const conversation = (conversations as Array<{ id?: string; participants?: ConversationParticipant[] }>)
      .find((c) => c.id === conversationId)
    if (!conversation) return

    const buyerParticipant = conversation.participants?.find(
      (p) => !ADMIN_EMAILS.has((p.user?.email ?? '').toLowerCase())
    )
    const buyerEmail = buyerParticipant?.user?.email
    if (!buyerEmail) {
      console.error('[CHAT EMAIL] Buyer email not found in conversation participants')
      return
    }

    const result = await sendMessageReplyNotification(buyerEmail, senderName, notifInput)
    if (!result.ok) console.error('[CHAT EMAIL] Failed to notify buyer:', result.error)
  } catch (err) {
    console.error('[CHAT EMAIL] Unexpected error in sendChatEmailNotification:', err)
  }
}

export async function GET(request: NextRequest) {
  const conversationId = request.nextUrl.searchParams.get('conversationId')
  if (!conversationId) {
    return buildChatErrorResponse(400, 'INVALID_REQUEST', 'conversationId is required.')
  }

  const upstreamUrl = `${API_BASE}/chat/conversations/${encodeURIComponent(conversationId)}/messages`

  try {
    const result = await proxyChatRequest({ request, method: 'GET', upstreamUrl })
    if ('errorResponse' in result) {
      return result.errorResponse
    }
    return await finalizeProxyResponse(request, result.upstream, result.authToken, result.refreshed, upstreamUrl)
  } catch (error) {
    console.error(`CHAT_PROXY -> GET ${upstreamUrl} -> ERROR`, error)
    return buildChatErrorResponse(500, 'CHAT_PROXY_ERROR', 'Failed to reach chat service.', upstreamUrl)
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null) as { conversationId?: string; content?: string } | null
  if (!payload?.conversationId || !payload?.content) {
    return buildChatErrorResponse(400, 'INVALID_REQUEST', 'conversationId and content are required.')
  }

  const upstreamUrl = `${API_BASE}/chat/messages`

  try {
    const result = await proxyChatRequest({
      request,
      method: 'POST',
      upstreamUrl,
      body: {
        conversationId: payload.conversationId,
        content: payload.content,
      },
    })
    if ('errorResponse' in result) {
      return result.errorResponse
    }

    // Fire-and-forget email notification (non-blocking)
    const { authToken } = result
    if (authToken?.email && authToken?.accessToken) {
      void sendChatEmailNotification(
        authToken.email,
        authToken.name ?? authToken.email,
        (authToken.role as string | undefined) ?? 'BUYER',
        payload.conversationId,
        payload.content,
        authToken.accessToken,
      )
    }

    return await finalizeProxyResponse(request, result.upstream, result.authToken, result.refreshed, upstreamUrl)
  } catch (error) {
    console.error(`CHAT_PROXY -> POST ${upstreamUrl} -> ERROR`, error)
    return buildChatErrorResponse(500, 'CHAT_PROXY_ERROR', 'Failed to reach chat service.', upstreamUrl)
  }
}
