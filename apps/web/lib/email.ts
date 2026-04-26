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

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    return { ok: false, error: 'Email service not configured.' }
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!response.ok) {
      const body = await response.text()
      return { ok: false, error: `Resend error: ${body}` }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

type ChatNotificationInput = {
  senderName: string
  messageContent: string
  conversationUrl: string
  conversationId: string
}

export async function sendMessageToAdminNotification(to: string, input: ChatNotificationInput) {
  const subject = `New message from ${input.senderName} — Korana Estate`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a">
      <h2 style="color:#059669">New Message on Korana Estate</h2>
      <p><strong>${input.senderName}</strong> has sent you a message:</p>
      <blockquote style="border-left:4px solid #059669;margin:12px 0;padding:10px 16px;background:#f0fdf4;border-radius:4px;font-size:15px;color:#14532d">
        ${input.messageContent.replace(/\n/g, '<br/>')}
      </blockquote>
      <p>
        <a href="${input.conversationUrl}" style="display:inline-block;padding:10px 20px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          View Conversation
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">Korana Estate · Coffee &amp; Spice Marketplace</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendMessageReplyNotification(to: string, adminName: string, input: ChatNotificationInput) {
  const subject = `${adminName} replied to your message — Korana Estate`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a">
      <h2 style="color:#059669">You have a reply on Korana Estate</h2>
      <p><strong>${adminName}</strong> responded to your message:</p>
      <blockquote style="border-left:4px solid #059669;margin:12px 0;padding:10px 16px;background:#f0fdf4;border-radius:4px;font-size:15px;color:#14532d">
        ${input.messageContent.replace(/\n/g, '<br/>')}
      </blockquote>
      <p>
        <a href="${input.conversationUrl}" style="display:inline-block;padding:10px 20px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          View Conversation
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">Korana Estate · Coffee &amp; Spice Marketplace</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}
