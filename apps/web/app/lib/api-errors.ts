export async function extractErrorMessage(response: Response) {
  const data = await response.json().catch(() => null)

  return (
    extractMessage(data?.error) ||
    extractMessage(data?.message) ||
    extractMessage(data) ||
    'Something went wrong. Please try again.'
  )
}

export function extractMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }

  if (Array.isArray(value)) {
    const parts = value.map(extractMessage).filter(Boolean) as string[]
    return parts.length ? parts.join(', ') : null
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return (
      extractMessage(record.message) ||
      extractMessage(record.error) ||
      extractMessage(record.details) ||
      null
    )
  }

  return null
}

export function parseJsonSafely<T>(text: string): T | null {
  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
