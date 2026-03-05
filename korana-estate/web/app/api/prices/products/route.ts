import { NextRequest } from 'next/server'
import { proxyPricesRequest } from '../_proxy'

export function GET(request: NextRequest) {
  return proxyPricesRequest({ request, upstreamPath: '/prices/products', method: 'GET' })
}
