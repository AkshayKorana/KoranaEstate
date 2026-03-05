import { NextRequest } from 'next/server'
import { proxyPricesRequest } from '../_proxy'

export function POST(request: NextRequest) {
  return proxyPricesRequest({ request, upstreamPath: '/prices/ingest', method: 'POST' })
}
