export function isPrismaSchemaCompatibilityError(error: unknown): boolean {
  const e = error as any
  if (e?.code) {
    return (
      e.code === 'P2021' ||
      e.code === 'P2022' ||
      e.code === 'P2011' ||
      e.code === 'P2032'
    )
  }

  const message = error instanceof Error ? error.message : String(error)
  return (
    /relation .* does not exist/i.test(message) ||
    /table .* does not exist/i.test(message) ||
    /column .* does not exist/i.test(message)
  )
}