import { Prisma } from '@prisma/client'

export function isPrismaSchemaCompatibilityError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      error.code === 'P2021' || // table missing
      error.code === 'P2022' || // column missing
      error.code === 'P2011' || // null constraint due schema mismatch
      error.code === 'P2032' // incompatible null/non-null field conversion
    )
  }

  const message = error instanceof Error ? error.message : String(error)
  return (
    /relation .* does not exist/i.test(message) ||
    /table .* does not exist/i.test(message) ||
    /column .* does not exist/i.test(message)
  )
}
