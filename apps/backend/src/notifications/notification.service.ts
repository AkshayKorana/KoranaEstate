import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'

type OrderNotificationPayload = {
  id: string
  sourceType?: string | null
  rawProductId?: string | null
  itemNameSnapshot?: string | null
  quantitySnapshot?: number | Prisma.Decimal | null
  customerName?: string | null
  phone?: string | null
  shippingAddress?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  area?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  landmark?: string | null
  orderNote?: string | null
  createdAt?: Date | string | null
  buyerEmail?: string | null
  items?: Array<{
    retailProductId?: string | null
  }>
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  private getAdminEmail() {
    return process.env.ADMIN_EMAIL?.trim() || 'akshay.koranaest@gmail.com'
  }

  private getProductId(order: OrderNotificationPayload) {
    if (order.rawProductId) return order.rawProductId
    return order.items?.[0]?.retailProductId || null
  }

  private getAddress(order: OrderNotificationPayload) {
    const parts = [
      order.addressLine1,
      order.addressLine2,
      order.landmark,
      order.area,
      order.city,
      order.state,
      order.pincode,
    ]
      .map((part) => part?.trim())
      .filter(Boolean)

    return order.shippingAddress?.trim() || parts.join(', ')
  }

  private getTimestamp(order: OrderNotificationPayload) {
    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date()
    return Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString()
  }

  async sendOrderEmail(order: OrderNotificationPayload) {
    const adminEmail = this.getAdminEmail()
    const emailUser = process.env.EMAIL_USER?.trim()
    const emailPass = process.env.EMAIL_APP_PASSWORD?.trim() || process.env.EMAIL_PASS?.trim()
    const emailHost = process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com'
    const emailPort = Number(process.env.EMAIL_PORT || 587)

    if (!emailUser || !emailPass) {
      console.warn(`[Notification] EMAIL_USER or EMAIL_APP_PASSWORD/EMAIL_PASS not configured. Skipping email for orderId=${order.id}`)
      return
    }

    const nodemailer = require('nodemailer')
    const transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: false,
      auth: { user: emailUser, pass: emailPass },
    })

    const productId = this.getProductId(order)
    const address = this.getAddress(order)
    const buyerEmail = order.buyerEmail?.trim()

    // --- Email 1: Owner notification ---
    try {
      console.log(`[Notification] Sending owner notification for orderId=${order.id} to ${adminEmail}`)
      await transporter.sendMail({
        from: emailUser,
        to: adminEmail,
        subject: `🛒 New COD Order Received - ${order.id}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px;">
            <h2>New COD Order Received</h2>
            <hr />
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Product / Listing ID:</strong> ${productId || '-'}</p>
            <p><strong>Quantity:</strong> ${order.quantitySnapshot ?? '-'}</p>
            <hr />
            <h3>Customer Details</h3>
            <p><strong>Name:</strong> ${order.customerName || '-'}</p>
            <p><strong>Email:</strong> ${buyerEmail || '-'}</p>
            <p><strong>Phone Number:</strong> ${order.phone || '-'}</p>
            <hr />
            <h3>Delivery Address</h3>
            <p><strong>Full Address:</strong> ${address || '-'}</p>
            <p><strong>City:</strong> ${order.city || '-'}</p>
            <p><strong>State:</strong> ${order.state || '-'}</p>
            <p><strong>Pincode:</strong> ${order.pincode || '-'}</p>
            <hr />
            <p><strong>Order Note:</strong> ${order.orderNote || 'None'}</p>
            <hr />
            <p style="font-size: 12px; color: #666;">Sent at ${this.getTimestamp(order)}</p>
          </div>
        `,
      })
      console.log(`[Notification] Owner email sent for orderId=${order.id}`)
    } catch (error) {
      console.error(`[Notification] Owner email failed for orderId=${order.id}:`, error)
      this.logger.error(
        `Order owner email failed for order=${order.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    // --- Email 2: Buyer confirmation (only if buyer email is available) ---
    if (buyerEmail) {
      try {
        console.log(`[Notification] Sending buyer confirmation for orderId=${order.id} to ${buyerEmail}`)
        await transporter.sendMail({
          from: emailUser,
          to: buyerEmail,
          subject: `✅ Order Confirmed - ${order.id} | Korana Estate`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px;">
              <h2 style="color: #2d6a4f;">Your Order is Confirmed!</h2>
              <p>Hi ${order.customerName || 'there'},</p>
              <p>Thank you for your order. We have received it and will process it shortly.</p>
              <hr />
              <p><strong>Order ID:</strong> ${order.id}</p>
              <p><strong>Item:</strong> ${order.itemNameSnapshot || productId || '-'}</p>
              <p><strong>Quantity:</strong> ${order.quantitySnapshot ?? '-'}</p>
              <hr />
              <h3>Delivery Address</h3>
              <p>${address || '-'}</p>
              <p>${order.city || ''} ${order.state || ''} ${order.pincode || ''}</p>
              <hr />
              <p>For any queries, reply to this email or contact us at <a href="mailto:${adminEmail}">${adminEmail}</a>.</p>
              <p style="font-size: 12px; color: #666;">Order placed at ${this.getTimestamp(order)}</p>
            </div>
          `,
        })
        console.log(`[Notification] Buyer confirmation email sent for orderId=${order.id}`)
      } catch (error) {
        console.error(`[Notification] Buyer email failed for orderId=${order.id}:`, error)
        this.logger.error(
          `Order buyer email failed for order=${order.id}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    } else {
      console.warn(`[Notification] No buyer email available for orderId=${order.id}, skipping buyer confirmation`)
    }
  }

  async appendOrderToSheet(order: OrderNotificationPayload) {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim()
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!spreadsheetId) {
      console.warn(`[Notification] GOOGLE_SHEETS_ID not configured. Skipping sheet append for orderId=${order.id}`)
      return
    }

    if (!clientEmail || !privateKey) {
      console.warn(`[Notification] Google service account credentials not configured. Skipping sheet append for orderId=${order.id}`)
      return
    }

    try {
      console.log(`[Notification] Appending to Google Sheets for orderId=${order.id}`)
      const { google } = require('googleapis')
      const auth = new google.auth.JWT(
        clientEmail,
        undefined,
        privateKey,
        ['https://www.googleapis.com/auth/spreadsheets'],
      )
      const sheets = google.sheets({ version: 'v4', auth })
      const productId = this.getProductId(order)
      const address = this.getAddress(order)

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A:K',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            this.getTimestamp(order),
            order.id,
            productId || '',
            order.quantitySnapshot ?? '',
            order.customerName || '',
            order.phone || '',
            address || '',
            order.city || '',
            order.state || '',
            order.pincode || '',
            order.orderNote || '',
          ]],
        },
      })
      console.log(`[Notification] Google Sheets updated successfully for orderId=${order.id}`)
    } catch (error) {
      console.error(`[Notification] Google Sheets update failed for orderId=${order.id}:`, error)
      this.logger.error(
        `Google Sheets order logging failed for order=${order.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async sendScraperFailureAlert(error: string, details: {
    trigger: string
    runAt: string
    attempts: number
    durationMs: number
    stderr: string
    stdout: string
  }) {
    const adminEmail = this.getAdminEmail()
    const emailUser = process.env.EMAIL_USER?.trim()
    const emailPass = process.env.EMAIL_APP_PASSWORD?.trim() || process.env.EMAIL_PASS?.trim()
    const emailHost = process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com'
    const emailPort = Number(process.env.EMAIL_PORT || 587)

    if (!emailUser || !emailPass) {
      console.warn(`[Notification] EMAIL_USER or EMAIL_APP_PASSWORD/EMAIL_PASS not configured. Skipping scraper failure alert`)
      return
    }

    try {
      console.log(`[Notification] Sending scraper failure alert`)
      const nodemailer = require('nodemailer')
      const transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: false,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      })

      await transporter.sendMail({
        from: emailUser,
        to: adminEmail,
        subject: `🚨 Coffee Board Scraper Failed - ${details.trigger}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px;">
            <h2 style="color: #dc2626;">Coffee Board Scraper Failure Alert</h2>
            <hr />
            <p><strong>Trigger:</strong> ${details.trigger}</p>
            <p><strong>Scheduled Run At:</strong> ${details.runAt}</p>
            <p><strong>Attempts:</strong> ${details.attempts}</p>
            <p><strong>Duration:</strong> ${(details.durationMs / 1000).toFixed(1)}s</p>
            <hr />
            <h3>Error Details</h3>
            <p><strong>Error:</strong> ${error}</p>
            <hr />
            <h3>Debug Output</h3>
            <h4>STDERR:</h4>
            <pre style="background: #f5f5f5; padding: 10px; font-size: 12px; overflow-x: auto; max-height: 300px;">${details.stderr || 'No stderr'}</pre>
            <hr />
            <p style="font-size: 12px; color: #666;">
              Alert sent at ${new Date().toISOString()}
            </p>
          </div>
        `,
      })
      console.log(`[Notification] Scraper failure alert sent successfully`)
    } catch (alertError) {
      console.error(`[Notification] Scraper failure alert failed:`, alertError)
      this.logger.error(
        `Scraper failure alert failed: ${alertError instanceof Error ? alertError.message : String(alertError)}`,
      )
    }
  }

  async notifyOrderCreated(order: OrderNotificationPayload) {
    console.log(`[Notification] Processing order ${order.id}`)
    
    // Email only (Sheets disabled until config added)
    await this.sendOrderEmail(order)
    
    console.log(`[Notification] Order ${order.id} processing complete`)
  }
}
