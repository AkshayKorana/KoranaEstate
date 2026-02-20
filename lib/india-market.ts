const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const LB_TO_KG = 2.2046226218
const DEFAULT_BAG_WEIGHT_KG = 50

const BAG_WEIGHT_BY_COMMODITY: Record<string, number> = {
  Arabica: 50,
  Robusta: 50,
  Pepper: 50,
  Cardamom: 25,
}

export type PriceUnit = 'inr_per_kg' | 'inr_per_50kg' | 'inr_per_quintal' | 'usd_per_lb'

export function round2(n: number): number {
  return Number(n.toFixed(2))
}

export function convertToInrPerKg(value: number, unit: PriceUnit, usdToInr: number): number {
  if (unit === 'inr_per_kg') return round2(value)
  if (unit === 'inr_per_50kg') return round2(value / 50)
  if (unit === 'inr_per_quintal') return round2(value / 100)
  return round2(value * usdToInr * LB_TO_KG)
}

export function getStandardBagWeightKg(commodityName: string): number {
  return BAG_WEIGHT_BY_COMMODITY[commodityName] ?? DEFAULT_BAG_WEIGHT_KG
}

export function toInrPerBag(inrPerKg: number | null, commodityName: string): number | null {
  if (inrPerKg == null) return null
  const bagWeightKg = getStandardBagWeightKg(commodityName)
  return round2(inrPerKg * bagWeightKg)
}

export function toInrPerQuintal(inrPerKg: number | null): number | null {
  if (inrPerKg == null) return null
  return round2(inrPerKg * 100)
}

export function getIstDayRangeUtc(base: Date = new Date()) {
  const istNow = new Date(base.getTime() + IST_OFFSET_MS)
  const y = istNow.getUTCFullYear()
  const m = istNow.getUTCMonth()
  const d = istNow.getUTCDate()

  const startUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS)
  const endUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS)

  return { startUtc, endUtc }
}

export function toIstDisplay(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
