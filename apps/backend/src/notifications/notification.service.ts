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
  items?: Array<{
    retailProductId?: string | null
  }>
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  private getAdminEmail() {
    return process.env.ADMIN_EMAIL?.trim() || ''
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
    const emailPass = process.env.EMAIL_PASS?.trim()
    const emailHost = process.env.EMAIL_HOST?.trim() || 'smtp.gmail.com'
    const emailPort = Number(process.env.EMAIL_PORT || 587)

    if (!adminEmail) {
      console.warn(`[Notification] ADMIN_EMAIL not configured. Skipping email for orderId=${order.id}`)
      return
    }

    if (!emailUser || !emailPass) {
      console.warn(`[Notification] EMAIL_USER or EMAIL_PASS not configured. Skipping email for orderId=${order.id}`)
      return
    }

    try {
      console.log(`[Notification] Sending email for orderId=${order.id} to ${adminEmail}`)
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

      const productId = this.getProductId(order)
      const address = this.getAddress(order)

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
            <p style="font-size: 12px; color: #666;">
              Sent at ${this.getTimestamp(order)}
            </p>
          </div>
        `,
      })
      console.log(`[Notification] Email sent successfully for orderId=${order.id}`)
    } catch (error) {
      console.error(`[Notification] Email failed for orderId=${order.id}:`, error)
      this.logger.error(
        `Order email notification failed for order=${order.id}: ${error instanceof Error ? error.message : String(error)}`,
      )
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

  async notifyOrderCreated(order: OrderNotificationPayload) {
    const startTime = Date.now()
    const customer = (order as any).customer || {}

    try {
      console.log(`[Notification] Triggered for orderId=${order.id}`)
      console.log(`[Notification] Snapshot`, {
        orderId: order.id,
        productId: (order as any).productId || (order as any).listingId || 'unknown',
        quantity: (order as any).quantity || (order as any).quantityKg || 'unknown',
        customerName: customer.fullName || 'N/A',
      })

      const results = await Promise.allSettled([
        this.sendOrderEmail(order),
        this.appendOrderToSheet(order),
      ])

      const emailResult = results[0]
      const sheetsResult = results[1]

      console.log(`[Notification] Email notification ${emailResult.status === 'fulfilled' ? '✓ fulfilled' : '✗ rejected'} for orderId=${order.id}`)
      console.log(`[Notification] Sheets notification ${sheetsResult.status === 'fulfilled' ? '✓ fulfilled' : '✗ rejected'} for orderId=${order.id}`)
      console.log(`[Notification] Completed for orderId=${order.id} in ${Date.now() - startTime}ms`)
    } catch (error) {
      console.error(`[Notification] Unexpected error in notifyOrderCreated for orderId=${order.id}:`, error)
      this.logger.error(`Notification failed for order=${order.id}: ${error instanceof Error ? error.message : String(error)}`)
      console.log(`[Notification] Completed for orderId=${order.id} in ${Date.now() - startTime}ms`)
    }
  }
}
