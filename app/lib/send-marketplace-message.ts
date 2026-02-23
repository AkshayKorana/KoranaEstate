import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

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

  const res = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipientId: input.recipientId,
      listingId: input.listingId,
      text,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to send marketplace message')
  }

  const conversationId: string | undefined = data?.conversationId
  if (!conversationId) {
    throw new Error('Conversation unavailable')
  }

  input.router.push(`/messages?conversationId=${encodeURIComponent(conversationId)}`)
}
