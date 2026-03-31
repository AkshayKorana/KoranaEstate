import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { encode, getToken } from 'next-auth/jwt'
import type { JWT } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'
const SESSION_MAX_AGE = 30 * 24 * 60 * 60

type AuthToken = JWT & {
  accessToken?: string
  refreshToken?: string
  role?: string
}

function isSecureCookie(request: NextRequest) {
  return Boolean(
    process.env.NEXTAUTH_URL?.startsWith('https://') ||
      process.env.VERCEL ||
      request.nextUrl.protocol === 'https:'
  )
}

function getSessionCookieName(request: NextRequest) {
  return isSecureCookie(request)
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'
}

function getSessionCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: isSecureCookie(request),
  }
}

export async function getAuthTokenFromRequest(request: NextRequest): Promise<AuthToken | null> {
  const session = await getServerSession(authOptions)
  if (typeof session?.accessToken === 'string' && session.accessToken) {
    return {
      sub: session.user?.id,
      email: session.user?.email ?? undefined,
      name: session.user?.name ?? undefined,
      role: session.user?.role,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    }
  }

  const token = await getToken({
    req: request as never,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isSecureCookie(request),
    cookieName: getSessionCookieName(request),
  })

  return token as AuthToken | null
}

export async function getAccessTokenFromRequest(request: NextRequest) {
  const token = await getAuthTokenFromRequest(request)
  return typeof token?.accessToken === 'string' ? token.accessToken : null
}

async function refreshAuthToken(token: AuthToken) {
  if (!token.refreshToken) {
    return null
  }

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token.refreshToken }),
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as
    | {
        user?: { id: string; email: string; fullName?: string | null; role?: string | null }
        accessToken?: string
        refreshToken?: string
      }
    | null

  if (!response.ok || !payload?.user || !payload.accessToken || !payload.refreshToken) {
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
  } satisfies AuthToken
}

type AuthenticatedUpstreamRequest = {
  request: NextRequest
  url: string
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: string
  retryOnAuthFailure?: boolean
}

type AuthenticatedUpstreamResult =
  | { errorResponse: NextResponse }
  | { upstream: Response; authToken: AuthToken; refreshed: boolean }

export async function fetchWithAuthRetry({
  request,
  url,
  method = 'GET',
  headers,
  body,
  retryOnAuthFailure = true,
}: AuthenticatedUpstreamRequest): Promise<AuthenticatedUpstreamResult> {
  const token = await getAuthTokenFromRequest(request)
  if (!token?.accessToken) {
    return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  let activeToken = token
  let refreshed = false

  const callUpstream = (accessToken: string) =>
    fetch(url, {
      method,
      headers: {
        ...(headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
      ...(body !== undefined ? { body } : {}),
      cache: 'no-store',
    })

  let upstream = await callUpstream(token.accessToken)

  if (retryOnAuthFailure && (upstream.status === 401 || upstream.status === 403)) {
    const nextToken = await refreshAuthToken(activeToken)
    if (nextToken?.accessToken) {
      activeToken = nextToken
      refreshed = true
      upstream = await callUpstream(nextToken.accessToken)
    }
  }

  return { upstream, authToken: activeToken, refreshed }
}

export async function attachRefreshedSession(
  request: NextRequest,
  response: NextResponse,
  authToken: AuthToken,
  refreshed: boolean,
) {
  if (!refreshed) {
    return response
  }

  const encoded = await encode({
    token: authToken,
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: SESSION_MAX_AGE,
  })

  response.cookies.set(getSessionCookieName(request), encoded, {
    ...getSessionCookieOptions(request),
    maxAge: SESSION_MAX_AGE,
  })

  return response
}
