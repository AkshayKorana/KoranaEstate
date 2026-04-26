import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { handleSessionExpired, readResponsePayload, toChatApiError } from './chat-client'

type ListingKind = 'raw' | 'estate' | 'store'
type ActionKind = 'contact' | 'message'

type SendMarketplaceMessageInput = {
  recipientId: string
  listingId: string
  listingName: string
  kind: ListingKind
  action: ActionKind
  router: AppRouterInstance
  // Optional rich details — when provided the message is much more informative
  details?: {
    pricePerKg?: number       // raw: ₹/kg
    pricePerBag?: number      // raw: ₹ per 50 kg bag
    quantityKg?: number       // raw: available kg
    price?: number            // store: unit price
    stock?: number            // store: units in stock
    category?: string         // store: product category
    location?: string         // raw: seller location
    grade?: string            // raw: grade
  }
}

function buildAutoText(input: Omit<SendMarketplaceMessageInput, 'router'>): string {
  const d = input.details

  if (input.kind === 'raw') {
    const lines: string[] = [
      `Hi! I am interested in purchasing your raw commodity listing on Korana Estate.`,
      ``,
      `📦 Commodity: ${input.listingName}${d?.grade ? ` (Grade: ${d.grade})` : ''}`,
    ]
    if (d?.location) lines.push(`📍 Location: ${d.location}`)
    if (d?.pricePerKg != null) lines.push(`💰 Listed Price: ₹${d.pricePerKg}/kg  |  ₹${(d.pricePerKg * 50).toLocaleString('en-IN')} per 50 kg bag`)
    if (d?.quantityKg != null) lines.push(`📊 Available Quantity: ${d.quantityKg.toLocaleString('en-IN')} kg`)
    lines.push(``)
    if (input.action === 'contact') {
      lines.push(`Could you please confirm availability and share your best price for bulk purchase?`)
      lines.push(`I may be interested in negotiating the quantity and price.`)
    } else {
      lines.push(`Is this listing still available? Please let me know your best offer.`)
    }
    return lines.join('\n')
  }

  if (input.kind === 'store') {
    const lines: string[] = [
      `Hi! I am interested in purchasing the following product from your store on Korana Estate.`,
      ``,
      `🛍️ Product: ${input.listingName}`,
    ]
    if (d?.category) lines.push(`🏷️ Category: ${d.category}`)
    if (d?.price != null) lines.push(`💰 Price: ₹${d.price.toFixed(2)} per unit`)
    if (d?.stock != null) lines.push(`📦 Stock: ${d.stock} units available`)
    lines.push(``)
    if (input.action === 'contact') {
      lines.push(`Could you please confirm availability and share any bulk pricing or offers?`)
    } else {
      lines.push(`Is this product still available? Please share more details.`)
    }
    return lines.join('\n')
  }

  // estate
  const base = `Hi! I am interested in this ${input.kind} listing: ${input.listingName}.`
  return input.action === 'contact'
    ? `${base} Please share availability and best final price.`
    : `${base} Is this still available?`
}

export async function sendMarketplaceMessage(input: SendMarketplaceMessageInput): Promise<void> {
  const text = buildAutoText(input)

  const conversationRes = await fetch('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId: input.recipientId,
    }),
    cache: 'no-store',
  })

  const conversationPayload = await readResponsePayload<{ id?: string }>(conversationRes)

  if (!conversationRes.ok) {
    const error = toChatApiError(conversationRes, conversationPayload)
    if (await handleSessionExpired(error)) {
      throw new Error(error.message)
    }
    console.error('Marketplace conversation failed', error.status, error.message)
    throw new Error(error.message)
  }

  const conversationId: string | undefined = conversationPayload.data?.id
  if (!conversationId) {
    throw new Error('Conversation unavailable')
  }

  const messageRes = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      content: text,
    }),
    cache: 'no-store',
  })

  const messagePayload = await readResponsePayload(messageRes)

  if (!messageRes.ok) {
    const error = toChatApiError(messageRes, messagePayload)
    if (await handleSessionExpired(error)) {
      throw new Error(error.message)
    }
    console.error('Marketplace send message failed', error.status, error.message)
    throw new Error(error.message)
  }

  input.router.push(`/messages?conversationId=${encodeURIComponent(conversationId)}`)
}
