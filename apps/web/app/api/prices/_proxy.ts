import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

type ProxyOptions = {
  request: NextRequest
  upstreamPath: string
  method: 'GET' | 'POST'
}

export function buildPricesProxyError(status: number, message: string, upstream: string, detail?: string) {
  return NextResponse.json(
    {
      error: 'PRICES_PROXY_ERROR',
      message,
      status,
      upstream,
      ...(detail ? { detail } : {}),
    },
    {
      status,
      headers: {
        'cache-control': 'no-store',
      },
    }
  )
}

export async function proxyPricesRequest({ request, upstreamPath, method }: ProxyOptions) {
  const upstreamUrl = `${API_BASE}${upstreamPath}`

  const headers: Record<string, string> = {
    'cache-control': 'no-store',
  }

  const authorization = request.headers.get('authorization')
  if (authorization) headers.authorization = authorization

  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret) headers['x-cron-secret'] = cronSecret

  let body: string | undefined
  if (method === 'POST') {
    body = await request.text()
    headers['content-type'] = request.headers.get('content-type') || 'application/json'
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      cache: 'no-store',
    })

    const text = await upstream.text()
    let payload: unknown = text
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = { raw: text }
      }
    }

    if (!upstream.ok) {
      const parsed = (payload as { error?: string; message?: string; detail?: string }) || {}
      return buildPricesProxyError(
        upstream.status,
        parsed.message || parsed.error || `Upstream request failed with status ${upstream.status}`,
        upstreamUrl,
        parsed.detail
      )
    }

    return NextResponse.json(payload, {
      status: upstream.status,
      headers: {
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    return buildPricesProxyError(
      500,
      'Failed to reach prices backend service.',
      upstreamUrl,
      error instanceof Error ? error.message : String(error)
    )
  }
}
