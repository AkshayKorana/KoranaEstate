export type NormalizedPriceUnit = 'kg' | 'quintal' | '50kg' | 'ton'

const UNIT_PATTERNS: Array<{ unit: NormalizedPriceUnit; pattern: RegExp }> = [
  { unit: '50kg', pattern: /\b(?:per|\/)?\s*50\s*kg\b/i },
  { unit: 'quintal', pattern: /\b(?:per|\/)?\s*(?:quintal|qtl|qtl\.|qintal)\b/i },
  { unit: 'ton', pattern: /\b(?:per|\/)?\s*(?:ton|tonne|metric ton)\b/i },
  { unit: 'kg', pattern: /\b(?:per|\/)?\s*kg\b/i },
]

export function detectPriceUnit(rawText?: string | null, explicitUnit?: string | null): NormalizedPriceUnit {
  const haystack = `${explicitUnit || ''} ${rawText || ''}`.toLowerCase()

  for (const candidate of UNIT_PATTERNS) {
    if (candidate.pattern.test(haystack)) {
      return candidate.unit
    }
  }

  return 'kg'
}

export function normalizePriceToKg(value: number, unit: string): number {
  const normalizedUnit = unit.toLowerCase().replace(/\s+/g, '')

  switch (normalizedUnit) {
    case 'kg':
      return value
    case 'quintal':
      return value / 100
    case '50kg':
      return value / 50
    case 'ton':
      return value / 1000
    default:
      return value
  }
}

export function isNormalizedPriceSane(value: number): boolean {
  return Number.isFinite(value) && value >= 1 && value <= 5000
}

export function normalizeDetectedPrice(value: number, rawText?: string | null, explicitUnit?: string | null) {
  const originalUnit = detectPriceUnit(rawText, explicitUnit)
  const normalizedValue = normalizePriceToKg(value, originalUnit)

  return {
    originalUnit,
    normalizedUnit: 'kg' as const,
    normalizedValue,
    sane: isNormalizedPriceSane(normalizedValue),
  }
}
