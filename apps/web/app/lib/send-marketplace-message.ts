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
}

function buildAutoText(input: Omit<SendMarketplaceMessageInput, 'router'>): string {
  const base = `Hi! I am interested in this ${input.kind} listing: ${input.listingName} (ID: ${input.listingId}).`
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
