import { NextRequest } from 'next/server'
import {
  buildChatErrorResponse,
  finalizeJsonResponse,
  finalizeProxyResponse,
  getApiBaseUrl,
  proxyChatRequest,
} from '../_lib'

const API_BASE = getApiBaseUrl()

export async function GET(request: NextRequest) {
  const upstreamUrl = `${API_BASE}/chat/unread-count`

  try {
    const direct = await proxyChatRequest({ request, method: 'GET', upstreamUrl })
    if ('errorResponse' in direct) {
      return direct.errorResponse
    }

    if (direct.upstream.ok) {
      return await finalizeProxyResponse(request, direct.upstream, direct.authToken, direct.refreshed, upstreamUrl)
    }

    if (direct.upstream.status !== 404) {
      return await finalizeProxyResponse(request, direct.upstream, direct.authToken, direct.refreshed, upstreamUrl)
    }

    const conversationsUrl = `${API_BASE}/chat/conversations`
    const fallback = await proxyChatRequest({
      request,
      method: 'GET',
      upstreamUrl: conversationsUrl,
      authToken: direct.authToken,
      retryOnAuthFailure: true,
    })

    if ('errorResponse' in fallback) {
      return fallback.errorResponse
    }

    if (!fallback.upstream.ok) {
      return await finalizeProxyResponse(request, fallback.upstream, fallback.authToken, direct.refreshed || fallback.refreshed, conversationsUrl)
    }

    const body = await fallback.upstream.text()
    let payload: unknown = []
    try {
      payload = body ? JSON.parse(body) : []
    } catch {
      payload = []
    }

    const conversations = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { conversations?: unknown[] })?.conversations)
        ? ((payload as { conversations?: unknown[] }).conversations ?? [])
        : []

    const unreadCount = conversations.reduce((total, conversation) => {
      const lastMessage = (conversation as { messages?: Array<{ senderId?: string; isRead?: boolean }> }).messages?.[0]
      if (!lastMessage) return total
      if (lastMessage.senderId === fallback.authToken.sub) return total
      if (lastMessage.isRead === false) return total + 1
      return total
    }, 0)

    console.info(`CHAT_PROXY -> GET ${conversationsUrl} -> 200 (computed unread-count=${unreadCount})`)

    return await finalizeJsonResponse(
      request,
      { unreadCount },
      fallback.authToken,
      direct.refreshed || fallback.refreshed,
      200
    )
  } catch (error) {
    console.error(`CHAT_PROXY -> GET ${upstreamUrl} -> ERROR`, error)
    return buildChatErrorResponse(500, 'CHAT_PROXY_ERROR', 'Failed to load unread count.', upstreamUrl)
  }
}
