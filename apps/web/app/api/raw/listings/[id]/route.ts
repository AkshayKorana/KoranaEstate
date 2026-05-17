import { NextRequest, NextResponse } from 'next/server'
import { extractMessage, parseJsonSafely } from '@/app/lib/api-errors'
import { attachRefreshedSession, fetchWithAuthRetry } from '@/app/api/_lib/auth'

export const dynamic = 'force-dynamic'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Listing ID required' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const upstreamResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/marketplace/listings/${id}`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if ('errorResponse' in upstreamResult) {
      return upstreamResult.errorResponse
    }

    const text = await upstreamResult.upstream.text()
    const payload = parseJsonSafely<Record<string, unknown>>(text)

    if (!upstreamResult.upstream.ok) {
      const error = extractMessage(payload) || 'Failed to update listing'
      const response = NextResponse.json({ error }, { status: upstreamResult.upstream.status })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const response = NextResponse.json(payload ?? {})
    return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('apps/web PATCH listing failed', error)
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Listing ID required' }, { status: 400 })
  }

  try {
    const upstreamResult = await fetchWithAuthRetry({
      request,
      url: `${API_BASE}/marketplace/listings/${id}`,
      method: 'DELETE',
    })
    if ('errorResponse' in upstreamResult) {
      return upstreamResult.errorResponse
    }

    const text = await upstreamResult.upstream.text()
    const payload = parseJsonSafely<{ message?: string; error?: string }>(text)

    if (!upstreamResult.upstream.ok) {
      const error = extractMessage(payload) || 'Failed to delete listing'
      const response = NextResponse.json({ error }, { status: upstreamResult.upstream.status })
      return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
    }

    const response = NextResponse.json({ success: true })
    return attachRefreshedSession(request, response, upstreamResult.authToken, upstreamResult.refreshed)
  } catch (error) {
    console.error('apps/web DELETE listing failed', error)
    return NextResponse.json({ error: 'Failed to delete listing' }, { status: 500 })
  }
}
