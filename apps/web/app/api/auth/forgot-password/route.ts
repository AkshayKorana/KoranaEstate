import { NextRequest, NextResponse } from 'next/server'
import { sendTempPasswordEmail } from '@/lib/email'

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    if (!API_BASE) {
      return NextResponse.json({ error: 'Service not configured.' }, { status: 500 })
    }

    // Ask backend to generate + store a temp password
    const upstream = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    })

    const data = await upstream.json().catch(() => ({}))

    // If user doesn't exist, backend returns { ok: true } with no tempPassword — still 200 to avoid enumeration
    if (!upstream.ok) {
      console.error('[FORGOT PASSWORD] Backend error:', data)
      return NextResponse.json({ ok: true }) // Always 200 to prevent email enumeration
    }

    if (data?.tempPassword) {
      const fullName = typeof data.fullName === 'string' ? data.fullName : 'there'
      const emailResult = await sendTempPasswordEmail(email, fullName, data.tempPassword)
      if (!emailResult.ok) {
        console.error('[FORGOT PASSWORD] Email send failed:', emailResult.error)
        // Still return ok — password was reset. User can retry or contact support.
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[FORGOT PASSWORD] Unexpected error:', error)
    return NextResponse.json({ ok: true }) // Always 200 to prevent enumeration
  }
}
