import { signOut } from 'next-auth/react'

export type ChatApiError = {
  error: string
  message: string
  status: number
  upstream?: string
}

export async function readResponsePayload<T = unknown>(response: Response) {
  const text = await response.text()
  let data: T | null = null

  try {
    data = text ? (JSON.parse(text) as T) : null
  } catch {
    data = null
  }

  return { text, data }
}

export function toChatApiError(
  response: Response,
  payload: { text: string; data: unknown }
): ChatApiError {
  const data = (payload.data ?? {}) as { error?: string; message?: string; upstream?: string }
  return {
    error: data.error || 'CHAT_REQUEST_FAILED',
    message: data.message || payload.text || `Request failed with status ${response.status}`,
    status: response.status,
    upstream: data.upstream,
  }
}

export async function handleSessionExpired(error: ChatApiError) {
  if (error.error !== 'SESSION_EXPIRED') {
    return false
  }

  await signOut({ callbackUrl: '/auth?error=session-expired' })
  return true
}
