import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 30)
    const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin
    const resetLink = `${baseUrl}/auth?tab=reset-password&token=${resetToken}`

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    })

    const emailResult = await sendPasswordResetEmail({
      to: email,
      resetLink,
    })

    if (!emailResult.ok) {
      console.error('Forgot password email send failed:', emailResult.error)
      return NextResponse.json(
        {
          error: 'Unable to send reset email. Please try again later.',
          detail: process.env.NODE_ENV === 'development' ? emailResult.error : undefined,
          // Development-only fallback so local testing can continue even without email service.
          resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      // Optional dev debug visibility.
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Failed to process forgot-password request.' }, { status: 500 })
  }
}
