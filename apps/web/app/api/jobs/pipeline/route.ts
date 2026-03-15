import type { NextRequest } from 'next/server'
import { proxyPricesRequest } from '../../prices/_proxy'

export async function POST(request: NextRequest) {
  return proxyPricesRequest({
    request,
    upstreamPath: '/jobs/prices/run',
    method: 'POST',
  })
}
