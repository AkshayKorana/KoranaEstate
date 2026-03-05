import { NextResponse } from 'next/server'

export function proxyTextResponse(body: string, status: number, contentType: string | null) {
  return new NextResponse(body, {
    status,
    headers: {
      'content-type': contentType || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function proxyErrorResponse(status: number, message: string, upstream?: string) {
  return NextResponse.json(
    {
      error: 'HOME_STAYS_PROXY_ERROR',
      message,
      status,
      ...(upstream ? { upstream } : {}),
    },
    {
      status,
      headers: {
        'cache-control': 'no-store',
      },
    }
  )
}
