import 'server-only'

type SendResetEmailInput = {
  to: string
  resetLink: string
}

export async function sendPasswordResetEmail({ to, resetLink }: SendResetEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    return {
      ok: false,
      error: 'Email service is not configured. Set RESEND_API_KEY and EMAIL_FROM.',
    }
  }

  const subject = 'Reset your Korana Estate password'
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Reset your password</h2>
      <p>You requested a password reset for your Korana Estate account.</p>
      <p>
        <a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;">
          Reset Password
        </a>
      </p>
      <p>If you didn't request this, you can ignore this email.</p>
      <p>This link expires in 30 minutes.</p>
    </div>
  `

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      return { ok: false, error: `Resend error: ${body}` }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown email send error',
    }
  }
}
