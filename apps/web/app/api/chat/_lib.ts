import { NextRequest, NextResponse } from 'next/server'
import { encode, getToken } from 'next-auth/jwt'
import type { JWT } from 'next-auth/jwt'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

const SESSION_MAX_AGE = 30 * 24 * 60 * 60

type ChatJwt = JWT & {
  accessToken?: string
  refreshToken?: string
  role?: string
}

type ProxyOptions = {
  request: NextRequest
  method: 'GET' | 'POST'
  upstreamUrl: string
  body?: unknown
  authToken?: ChatJwt | null
  retryOnAuthFailure?: boolean
}

type ProxyResult =
  | { errorResponse: NextResponse }
  | { upstream: Response; authToken: ChatJwt; refreshed: boolean }

export function getApiBaseUrl() {
  return API_BASE
}

function isSecureCookie(request: NextRequest) {
  return Boolean(
    process.env.NEXTAUTH_URL?.startsWith('https://') ||
      process.env.VERCEL ||
      request.nextUrl.protocol === 'https:'
  )
}

function getSessionCookie(request: NextRequest) {
  const secure = isSecureCookie(request)
  return {
    name: secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      secure,
    },
  }
}

export function buildChatErrorResponse(
  status: number,
  error: string,
  message: string,
  upstream?: string
) {
  return NextResponse.json(
    {
      error,
      message,
      status,
      ...(upstream ? { upstream } : {}),
    },
    {
      status,
      headers: { 'cache-control': 'no-store' },
    }
  )
}

async function getAuthToken(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const token = (await getToken({
    req: request as never,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isSecureCookie(request),
    cookieName: sessionCookie.name,
  })) as ChatJwt | null

  return token
}

async function attachSessionCookie(response: NextResponse, request: NextRequest, token: ChatJwt) {
  const sessionCookie = getSessionCookie(request)
  const encoded = await encode({
    token,
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: SESSION_MAX_AGE,
  })

  response.cookies.set(sessionCookie.name, encoded, {
    ...sessionCookie.options,
    maxAge: SESSION_MAX_AGE,
  })
}

function clearSessionCookie(response: NextResponse, request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  response.cookies.set(sessionCookie.name, '', {
    ...sessionCookie.options,
    maxAge: 0,
    expires: new Date(0),
  })
}

async function callUpstream(accessToken: string, method: 'GET' | 'POST', upstreamUrl: string, body?: unknown) {
  const upstream = await fetch(upstreamUrl, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })

  console.info(`CHAT_PROXY -> ${method} ${upstreamUrl} -> ${upstream.status}`)
  return upstream
}

async function refreshAuthToken(request: NextRequest, token: ChatJwt) {
  if (!token.refreshToken) {
    return null
  }

  const upstreamUrl = `${API_BASE}/auth/refresh`
  const response = await fetch(upstreamUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token.refreshToken }),
    cache: 'no-store',
  })

  console.info(`CHAT_PROXY -> POST ${upstreamUrl} -> ${response.status}`)

  if (!response.ok) {
    return null
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        user?: { id: string; email: string; fullName?: string | null; role?: string | null }
        accessToken?: string
        refreshToken?: string
      }
    | null

  if (!payload?.user || !payload.accessToken || !payload.refreshToken) {
    return null
  }

  return {
    ...token,
    sub: payload.user.id,
    email: payload.user.email,
    name: payload.user.fullName ?? undefined,
    role: payload.user.role ?? undefined,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
  } satisfies ChatJwt
}

export async function proxyChatRequest({
  request,
  method,
  upstreamUrl,
  body,
  authToken,
  retryOnAuthFailure = true,
}: ProxyOptions): Promise<ProxyResult> {
  const token = authToken ?? (await getAuthToken(request))

  if (!token?.accessToken) {
    return {
      errorResponse: buildChatErrorResponse(401, 'UNAUTHENTICATED', 'Authentication required.', upstreamUrl),
    }
  }

  let activeToken = token
  let refreshed = false
  let upstream = await callUpstream(token.accessToken, method, upstreamUrl, body)

  if (retryOnAuthFailure && (upstream.status === 401 || upstream.status === 403)) {
    const nextToken = await refreshAuthToken(request, activeToken)

    if (!nextToken?.accessToken) {
      const response = buildChatErrorResponse(
        401,
        'SESSION_EXPIRED',
        'Session expired. Please sign in again.',
        upstreamUrl
      )
      clearSessionCookie(response, request)
      return { errorResponse: response }
    }

    activeToken = nextToken
    refreshed = true
    upstream = await callUpstream(nextToken.accessToken, method, upstreamUrl, body)
  }

  return { upstream, authToken: activeToken, refreshed }
}

export async function finalizeProxyResponse(
  request: NextRequest,
  upstream: Response,
  authToken: ChatJwt,
  refreshed: boolean,
  upstreamUrl: string
) {
  const contentType = upstream.headers.get('content-type')
  const body = await upstream.text()

  if (!upstream.ok) {
    let parsed: { error?: string; message?: string } = {}
    try {
      parsed = body ? JSON.parse(body) : {}
    } catch {
      parsed = {}
    }

    const response = buildChatErrorResponse(
      upstream.status,
      parsed.error || 'CHAT_UPSTREAM_ERROR',
      parsed.message || body || `Upstream request failed with status ${upstream.status}`,
      upstreamUrl
    )

    if (refreshed) {
      await attachSessionCookie(response, request, authToken)
    }

    return response
  }

  const response = new NextResponse(body, {
    status: upstream.status,
    headers: {
      'content-type': contentType || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })

  if (refreshed) {
    await attachSessionCookie(response, request, authToken)
  }

  return response
}

export async function finalizeJsonResponse(
  request: NextRequest,
  payload: unknown,
  authToken: ChatJwt,
  refreshed: boolean,
  status = 200
) {
  const response = NextResponse.json(payload, {
    status,
    headers: { 'cache-control': 'no-store' },
  })

  if (refreshed) {
    await attachSessionCookie(response, request, authToken)
  }

  return response
}
