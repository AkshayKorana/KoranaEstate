function normalizeOrigin(value: string | undefined | null) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    return new URL(trimmed).origin
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

export function resolveAllowedOrigins(...values: Array<string | undefined | null>) {
  const defaults = [
    'https://korana-estate.vercel.app',
  ]

  const envValues = values
    .flatMap((value) => (value || '').split(','))
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value))

  return [...new Set([...defaults, ...envValues])]
}
