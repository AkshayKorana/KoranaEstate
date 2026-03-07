import { NextRequest } from 'next/server'
import { proxyErrorResponse, proxyTextResponse } from './_response'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString()
  const upstreamUrl = `${API_BASE}/home-stays${query ? `?${query}` : ''}`

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      cache: 'no-store',
    })

    const body = await upstream.text()
    console.info(`[home-stays proxy] GET ${upstreamUrl} -> ${upstream.status}`)
    return proxyTextResponse(body, upstream.status, upstream.headers.get('content-type'))
  } catch (error) {
    console.error(`[home-stays proxy] GET ${upstreamUrl} failed`, error)
    return proxyErrorResponse(500, 'Failed to reach home stays service.', upstreamUrl)
  }
}
