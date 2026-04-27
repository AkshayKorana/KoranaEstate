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

type OfferNotificationInput = {
  buyerName: string
  buyerEmail: string
  commodity: string
  location: string
  quantityKg: number
  askingPricePerKg: number
  offerPricePerKg: number
  message: string | null
  listingsUrl: string
}

export async function sendOfferToAdminNotification(to: string, input: OfferNotificationInput) {
  const subject = `New offer on ${input.commodity} from ${input.buyerName} — Korana Estate`
  const totalOffer = (input.offerPricePerKg * input.quantityKg).toLocaleString('en-IN')
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a">
      <h2 style="color:#059669">New Offer Received — Korana Estate</h2>
      <p><strong>${input.buyerName}</strong> (${input.buyerEmail}) has submitted an offer on your raw commodity listing.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:600;color:#065f46">Commodity</td><td style="padding:10px 14px">${input.commodity}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;color:#065f46">Location</td><td style="padding:10px 14px">${input.location}</td></tr>
        <tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:600;color:#065f46">Quantity</td><td style="padding:10px 14px">${input.quantityKg} kg (${Math.round(input.quantityKg / 50)} × 50 kg bags)</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;color:#065f46">Your Asking Price</td><td style="padding:10px 14px">₹${input.askingPricePerKg}/kg · ₹${(input.askingPricePerKg * 50).toLocaleString('en-IN')}/bag</td></tr>
        <tr style="background:#fffbeb"><td style="padding:10px 14px;font-weight:700;color:#92400e">Buyer's Offer</td><td style="padding:10px 14px;font-weight:700;color:#d97706">₹${input.offerPricePerKg}/kg · ₹${(input.offerPricePerKg * 50).toLocaleString('en-IN')}/bag</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;color:#065f46">Total Value</td><td style="padding:10px 14px;font-weight:700">₹${totalOffer}</td></tr>
        ${input.message ? `<tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:600;color:#065f46">Message</td><td style="padding:10px 14px">${input.message.replace(/\n/g, '<br/>')}</td></tr>` : ''}
      </table>
      <p>
        <a href="${input.listingsUrl}" style="display:inline-block;padding:10px 20px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          View Raw Marketplace
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">Reply to this buyer via the Messages section in Korana Estate.</p>
      <p style="color:#6b7280;font-size:13px">Korana Estate · Coffee &amp; Spice Marketplace</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendOfferConfirmationToUser(to: string, input: OfferNotificationInput) {
  const subject = `Your offer on ${input.commodity} has been submitted — Korana Estate`
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a">
      <h2 style="color:#059669">Offer Submitted Successfully!</h2>
      <p>Hi <strong>${input.buyerName}</strong>, your offer has been sent to the seller and they will get back to you shortly.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:600;color:#065f46">Commodity</td><td style="padding:10px 14px">${input.commodity}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;color:#065f46">Location</td><td style="padding:10px 14px">${input.location}</td></tr>
        <tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:600;color:#065f46">Quantity</td><td style="padding:10px 14px">${input.quantityKg} kg (${Math.round(input.quantityKg / 50)} × 50 kg bags)</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;color:#065f46">Seller's Asking Price</td><td style="padding:10px 14px">₹${input.askingPricePerKg}/kg · ₹${(input.askingPricePerKg * 50).toLocaleString('en-IN')}/bag</td></tr>
        <tr style="background:#fffbeb"><td style="padding:10px 14px;font-weight:700;color:#92400e">Your Offer</td><td style="padding:10px 14px;font-weight:700;color:#d97706">₹${input.offerPricePerKg}/kg · ₹${(input.offerPricePerKg * 50).toLocaleString('en-IN')}/bag</td></tr>
        ${input.message ? `<tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:600;color:#065f46">Your Note</td><td style="padding:10px 14px">${input.message.replace(/\n/g, '<br/>')}</td></tr>` : ''}
      </table>
      <p>You will receive a notification when the seller responds to your offer.</p>
      <p>
        <a href="${input.listingsUrl}" style="display:inline-block;padding:10px 20px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          View Raw Marketplace
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">Korana Estate · Coffee &amp; Spice Marketplace</p>
    </div>
  `
  return sendEmail({ to, subject, html })
}

export async function sendTempPasswordEmail(to: string, fullName: string, tempPassword: string) {
  const subject = 'Your temporary password — Korana Estate'
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:480px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#065f46,#059669);padding:28px 24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Korana Estate</h1>
        <p style="color:#a7f3d0;margin:4px 0 0;font-size:13px">Coffee &amp; Spice Marketplace</p>
      </div>
      <div style="background:#ffffff;padding:28px 24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
        <h2 style="color:#065f46;margin:0 0 12px">Password Reset</h2>
        <p>Hi <strong>${fullName}</strong>,</p>
        <p>We received a request to reset your password. Use the temporary password below to log in:</p>
        <div style="background:#f0fdf4;border:2px solid #059669;border-radius:10px;padding:18px 24px;text-align:center;margin:20px 0">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Temporary Password</p>
          <p style="margin:0;font-size:28px;font-weight:800;letter-spacing:4px;color:#065f46;font-family:monospace">${tempPassword}</p>
        </div>
        <p style="color:#374151">After logging in, please change your password immediately from your account settings.</p>
        <p style="color:#6b7280;font-size:13px;margin-top:20px">If you did not request this, you can safely ignore this email.</p>
        <p style="color:#6b7280;font-size:13px">Korana Estate · Coffee &amp; Spice Marketplace</p>
      </div>
    </div>
  `
  return sendEmail({ to, subject, html })
}
