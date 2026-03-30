import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { authOptions } from '@/lib/auth'

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

export async function getAccessTokenFromRequest(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (typeof session?.accessToken === 'string' && session.accessToken) {
    return session.accessToken
  }

  const token = await getToken({
    req: request as never,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: isSecureCookie(request),
    cookieName: getSessionCookieName(request),
  })

  return typeof token?.accessToken === 'string' ? token.accessToken : null
}
