import { NextRequest, NextResponse } from 'next/server'
import { extractMessage, parseJsonSafely } from '@/app/lib/api-errors'
import { resolveRole } from '@/lib/auth'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')

export async function POST(request: NextRequest) {
  try {
    if (!API_BASE) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_API_URL is not configured.' }, { status: 500 })
    }

    const body = await request.json()
    const fullName = typeof body?.name === 'string' ? body.name.trim() : ''
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    // Role is determined server-side by the whitelist — client input is ignored
    const role = resolveRole(email)
    const upstream = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        fullName,
        role,
      }),
      cache: 'no-store',
    })

    const text = await upstream.text()
    const payload = parseJsonSafely<{ user?: unknown; message?: unknown; error?: unknown }>(text) ?? {}

    if (!upstream.ok) {
      const error = extractMessage(payload) || 'Signup failed.'
      return NextResponse.json({ error }, { status: upstream.status })
    }

    const user = payload.user
    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('apps/web signup proxy failed', error)
    return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
  }
}
