import { NextRequest, NextResponse } from 'next/server'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const fullName = typeof body?.name === 'string' ? body.name.trim() : ''
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    const upstream = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        fullName,
        role: 'BUYER',
      }),
      cache: 'no-store',
    })

    const text = await upstream.text()
    let payload: unknown = {}

    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      payload = {}
    }

    if (!upstream.ok) {
      const error =
        (payload as { message?: string; error?: string })?.message ||
        (payload as { error?: string })?.error ||
        'Signup failed.'
      return NextResponse.json({ error }, { status: upstream.status })
    }

    const user = (payload as { user?: unknown })?.user
    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error('apps/web signup proxy failed', error)
    return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
  }
}
