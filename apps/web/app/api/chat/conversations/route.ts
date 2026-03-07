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
  const upstreamUrl = `${API_BASE}/chat/conversations`
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
  const payload = await request.json().catch(() => null) as { participantId?: string } | null
  if (!payload?.participantId) {
    return buildChatErrorResponse(400, 'INVALID_REQUEST', 'participantId is required.')
  }

  const upstreamUrl = `${API_BASE}/chat/conversations`

  try {
    const lookup = await proxyChatRequest({ request, method: 'GET', upstreamUrl })
    if ('errorResponse' in lookup) {
      return lookup.errorResponse
    }

    if (lookup.upstream.ok) {
      const lookupText = await lookup.upstream.text()
      let lookupData: unknown = []
      try {
        lookupData = lookupText ? JSON.parse(lookupText) : []
      } catch {
        lookupData = []
      }

      const conversations = Array.isArray(lookupData)
        ? lookupData
        : Array.isArray((lookupData as { conversations?: unknown[] })?.conversations)
          ? ((lookupData as { conversations?: unknown[] }).conversations ?? [])
          : []

      const existing = conversations.find((conversation) => {
        const participants = (conversation as { participants?: Array<{ userId?: string; user?: { id?: string } }> }).participants ?? []
        return participants.some(
          (participant) =>
            participant.userId === payload.participantId || participant.user?.id === payload.participantId
        )
      })

      if (existing) {
        console.info(`CHAT_PROXY -> POST ${upstreamUrl} -> 200 (reused existing conversation)`)
        return await finalizeJsonResponse(request, existing, lookup.authToken, lookup.refreshed, 200)
      }
    } else {
      return await finalizeProxyResponse(request, lookup.upstream, lookup.authToken, lookup.refreshed, upstreamUrl)
    }

    const create = await proxyChatRequest({
      request,
      method: 'POST',
      upstreamUrl,
      body: { participantId: payload.participantId },
      authToken: lookup.authToken,
      retryOnAuthFailure: true,
    })
    if ('errorResponse' in create) {
      return create.errorResponse
    }
    return await finalizeProxyResponse(request, create.upstream, create.authToken, create.refreshed || lookup.refreshed, upstreamUrl)
  } catch (error) {
    console.error(`CHAT_PROXY -> POST ${upstreamUrl} -> ERROR`, error)
    return buildChatErrorResponse(500, 'CHAT_PROXY_ERROR', 'Failed to reach chat service.', upstreamUrl)
  }
}
