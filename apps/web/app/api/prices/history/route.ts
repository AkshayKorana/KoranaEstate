import { NextRequest } from 'next/server'
import { proxyPricesRequest } from '../_proxy'

export function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString()
  const upstreamPath = `/prices/history${query ? `?${query}` : ''}`
  return proxyPricesRequest({ request, upstreamPath, method: 'GET' })
}
