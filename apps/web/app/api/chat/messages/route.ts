import { NextRequest } from 'next/server'
import {
  buildChatErrorResponse,
  finalizeProxyResponse,
  getApiBaseUrl,
  proxyChatRequest,
} from '../_lib'

const API_BASE = getApiBaseUrl()

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
    return await finalizeProxyResponse(request, result.upstream, result.authToken, result.refreshed, upstreamUrl)
  } catch (error) {
    console.error(`CHAT_PROXY -> POST ${upstreamUrl} -> ERROR`, error)
    return buildChatErrorResponse(500, 'CHAT_PROXY_ERROR', 'Failed to reach chat service.', upstreamUrl)
  }
}
