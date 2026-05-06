import 'server-only'
import nodemailer from 'nodemailer'

function createTransporter() {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_APP_PASSWORD
  if (!user || !pass) return null
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  })
}

const FROM_ADDRESS = () => process.env.EMAIL_FROM || `Korana Estate <${process.env.EMAIL_USER}>`

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const transporter = createTransporter()
  if (!transporter) {
    return { ok: false, error: 'Email service not configured. Set EMAIL_USER and EMAIL_APP_PASSWORD.' }
  }
  try {
    await transporter.sendMail({ from: FROM_ADDRESS(), to, subject, html })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown email error' }
  }
}

export async function sendPasswordResetEmail({ to, resetLink }: { to: string; resetLink: string }) {
  const subject = 'Reset your Korana Estate password'
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Reset your password</h2>
      <p>You requested a password reset for your Korana Estate account.</p>
      <p><a href="${resetLink}" style="display:inline-block;padding:10px 16px;background:#059669;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
      <p>If you didn't request this, you can ignore this email. This link expires in 30 minutes.</p>
    </div>
  `
  return sendEmail({ to, subject, html })
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

// ─── Order emails ──────────────────────────────────────────────────────────────

type StoreOrderEmailInput = {
  orderId: string
  buyerName: string
  buyerEmail: string
  itemName: string
  itemCategory: string | null
  sellerName: string | null
  quantity: number
  unitLabel: string
  unitPrice: number
  totalPrice: number
  addressLine1: string
  addressLine2: string
  area: string
  city: string
  state: string
  pincode: string
  landmark: string
  mobileNumber: string
  orderNote: string
}

function storeOrderTable(o: StoreOrderEmailInput) {
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:600;color:#065f46">Order ID</td><td style="padding:10px 14px;font-family:monospace">${o.orderId}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;color:#065f46">Item</td><td style="padding:10px 14px">${o.itemName}${o.itemCategory ? ` <span style="color:#6b7280;font-size:12px">(${o.itemCategory})</span>` : ''}</td></tr>
      ${o.sellerName ? `<tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:600;color:#065f46">Seller</td><td style="padding:10px 14px">${o.sellerName}</td></tr>` : ''}
      <tr style="${o.sellerName ? '' : 'background:#f0fdf4'}"><td style="padding:10px 14px;font-weight:600;color:#065f46">Quantity</td><td style="padding:10px 14px">${o.quantity} ${o.unitLabel}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;color:#065f46">Unit Price</td><td style="padding:10px 14px">₹${o.unitPrice.toLocaleString('en-IN')}</td></tr>
      <tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:700;color:#065f46">Total (COD)</td><td style="padding:10px 14px;font-weight:700;color:#059669;font-size:16px">₹${o.totalPrice.toLocaleString('en-IN')}</td></tr>
    </table>
    <p style="font-size:14px;font-weight:600;color:#374151;margin:16px 0 4px">Delivery Address</p>
    <p style="font-size:14px;color:#374151;margin:0">${o.buyerName} · ${o.mobileNumber}<br/>${o.addressLine1}${o.addressLine2 ? ', ' + o.addressLine2 : ''}, ${o.area}, ${o.city} – ${o.pincode}, ${o.state}${o.landmark ? '<br/>Landmark: ' + o.landmark : ''}${o.orderNote ? '<br/>Note: ' + o.orderNote : ''}</p>
  `
}

export async function sendStoreOrderEmails(order: StoreOrderEmailInput) {
  const ADMIN = process.env.EMAIL_USER || 'akshay.koranaest@gmail.com'

  const userHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:520px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#065f46,#059669);padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px">Korana Estate</h1>
        <p style="color:#a7f3d0;margin:4px 0 0;font-size:12px">Coffee &amp; Spice Marketplace</p>
      </div>
      <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
        <h2 style="color:#065f46;margin:0 0 8px">Order Confirmed! 🎉</h2>
        <p>Hi <strong>${order.buyerName}</strong>, your order has been placed successfully. Pay on delivery.</p>
        ${storeOrderTable(order)}
        <p style="color:#6b7280;font-size:13px;margin-top:20px">You will receive a call to confirm delivery. Questions? Reply to this email.</p>
        <p style="color:#6b7280;font-size:13px">Korana Estate · Coffee &amp; Spice Marketplace</p>
      </div>
    </div>
  `

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:520px;margin:0 auto">
      <h2 style="color:#059669">New Store Order — Korana Estate</h2>
      <p><strong>${order.buyerName}</strong> (${order.buyerEmail}) placed a COD order.</p>
      ${storeOrderTable(order)}
    </div>
  `

  const [userResult, adminResult] = await Promise.allSettled([
    sendEmail({ to: order.buyerEmail, subject: `Order Confirmed — ${order.itemName} · Korana Estate`, html: userHtml }),
    sendEmail({ to: ADMIN, subject: `New Store Order: ${order.itemName} from ${order.buyerName}`, html: adminHtml }),
  ])

  return { user: userResult, admin: adminResult }
}

// ── Raw marketplace order ──

type RawOrderEmailInput = {
  orderId: string
  buyerName: string
  buyerEmail: string
  commodityName: string
  location: string | null
  quantityKg: number
  pricePerKg: number
  totalPrice: number
  addressLine1: string
  addressLine2: string
  area: string
  city: string
  state: string
  pincode: string
  landmark: string
  mobileNumber: string
  orderNote: string
}

function rawOrderTable(o: RawOrderEmailInput) {
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:600;color:#065f46">Order ID</td><td style="padding:10px 14px;font-family:monospace">${o.orderId}</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;color:#065f46">Commodity</td><td style="padding:10px 14px">${o.commodityName}</td></tr>
      ${o.location ? `<tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:600;color:#065f46">Location</td><td style="padding:10px 14px">${o.location}</td></tr>` : ''}
      <tr style="${o.location ? '' : 'background:#f0fdf4'}"><td style="padding:10px 14px;font-weight:600;color:#065f46">Quantity</td><td style="padding:10px 14px">${o.quantityKg} kg</td></tr>
      <tr><td style="padding:10px 14px;font-weight:600;color:#065f46">Price / kg</td><td style="padding:10px 14px">₹${o.pricePerKg.toLocaleString('en-IN')}</td></tr>
      <tr style="background:#f0fdf4"><td style="padding:10px 14px;font-weight:700;color:#065f46">Total (COD)</td><td style="padding:10px 14px;font-weight:700;color:#059669;font-size:16px">₹${o.totalPrice.toLocaleString('en-IN')}</td></tr>
    </table>
    <p style="font-size:14px;font-weight:600;color:#374151;margin:16px 0 4px">Delivery Address</p>
    <p style="font-size:14px;color:#374151;margin:0">${o.buyerName} · ${o.mobileNumber}<br/>${o.addressLine1}${o.addressLine2 ? ', ' + o.addressLine2 : ''}, ${o.area}, ${o.city} – ${o.pincode}, ${o.state}${o.landmark ? '<br/>Landmark: ' + o.landmark : ''}${o.orderNote ? '<br/>Note: ' + o.orderNote : ''}</p>
  `
}

export async function sendRawOrderEmails(order: RawOrderEmailInput) {
  const ADMIN = process.env.EMAIL_USER || 'akshay.koranaest@gmail.com'

  const userHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:520px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#065f46,#059669);padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px">Korana Estate</h1>
        <p style="color:#a7f3d0;margin:4px 0 0;font-size:12px">Coffee &amp; Spice Marketplace</p>
      </div>
      <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
        <h2 style="color:#065f46;margin:0 0 8px">Order Confirmed! 🎉</h2>
        <p>Hi <strong>${order.buyerName}</strong>, your raw commodity order has been placed. Pay on delivery.</p>
        ${rawOrderTable(order)}
        <p style="color:#6b7280;font-size:13px;margin-top:20px">You will receive a call to confirm delivery. Questions? Reply to this email.</p>
        <p style="color:#6b7280;font-size:13px">Korana Estate · Coffee &amp; Spice Marketplace</p>
      </div>
    </div>
  `

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:520px;margin:0 auto">
      <h2 style="color:#059669">New Raw Commodity Order — Korana Estate</h2>
      <p><strong>${order.buyerName}</strong> (${order.buyerEmail}) placed a COD order.</p>
      ${rawOrderTable(order)}
    </div>
  `

  const [userResult, adminResult] = await Promise.allSettled([
    sendEmail({ to: order.buyerEmail, subject: `Order Confirmed — ${order.commodityName} · Korana Estate`, html: userHtml }),
    sendEmail({ to: ADMIN, subject: `New Raw Order: ${order.commodityName} from ${order.buyerName}`, html: adminHtml }),
  ])

  return { user: userResult, admin: adminResult }
}

// ── Temp password ──

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
