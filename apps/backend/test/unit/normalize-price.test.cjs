const test = require('node:test')
const assert = require('node:assert/strict')
const {
  normalizePriceToKg,
  detectPriceUnit,
  normalizeDetectedPrice,
  normalizePriceForIngest,
} = require('../../dist/src/utils/normalizePrice.js')

test('normalizePriceToKg keeps kg unchanged', () => {
  assert.equal(normalizePriceToKg(359, 'kg'), 359)
})

test('normalizePriceToKg converts quintal to kg', () => {
  assert.equal(normalizePriceToKg(61879, 'quintal'), 618.79)
})

test('normalizePriceToKg converts 50kg to kg', () => {
  assert.equal(normalizePriceToKg(26300, '50kg'), 526)
})

test('normalizePriceToKg converts quintal example 19550', () => {
  assert.equal(normalizePriceToKg(19550, 'quintal'), 195.5)
})

test('detectPriceUnit finds unit from scraped text', () => {
  assert.equal(detectPriceUnit('₹61,879 per quintal'), 'quintal')
  assert.equal(detectPriceUnit('₹26,300–27,000 per 50 kg'), '50kg')
  assert.equal(detectPriceUnit('₹359 / kg'), 'kg')
})

test('normalizeDetectedPrice returns normalized metadata for quintal input', () => {
  const result = normalizeDetectedPrice(61879, '₹61,879 / quintal', 'INR/kg')
  assert.equal(result.originalUnit, 'quintal')
  assert.equal(result.normalizedUnit, 'kg')
  assert.equal(result.normalizedValue, 618.79)
  assert.equal(result.sane, true)
})

test('already-normalized parser midpoint is not normalized again', () => {
  const result = normalizePriceForIngest(533, {
    rawText: '₹26,300–27,000 per 50 kg',
    explicitUnit: 'INR/kg',
    valuesAlreadyNormalized: true,
  })

  assert.equal(result.originalUnit, '50kg')
  assert.equal(result.normalizedValue, 533)
  assert.equal(result.valuesAlreadyNormalized, true)
})

test('already-normalized min/max are not normalized again', () => {
  const min = normalizePriceForIngest(526, {
    rawText: '₹26,300 per 50 kg',
    explicitUnit: 'INR/kg',
    valuesAlreadyNormalized: true,
  })
  const max = normalizePriceForIngest(540, {
    rawText: '₹27,000 per 50 kg',
    explicitUnit: 'INR/kg',
    valuesAlreadyNormalized: true,
  })

  assert.equal(min.normalizedValue, 526)
  assert.equal(max.normalizedValue, 540)
})

test('mixed payload safety normalizes raw-unit values exactly once', () => {
  const rawQuintal = normalizePriceForIngest(61879, {
    rawText: '₹61,879 / quintal',
    explicitUnit: 'quintal',
    valuesAlreadyNormalized: false,
  })
  const normalizedCoffee = normalizePriceForIngest(444, {
    rawText: '₹22,200 per 50 kg',
    explicitUnit: 'INR/kg',
    valuesAlreadyNormalized: true,
  })

  assert.equal(rawQuintal.normalizedValue, 618.79)
  assert.equal(normalizedCoffee.normalizedValue, 444)
})

test('metadata preservation remains possible with explicit normalized flag', () => {
  const result = normalizePriceForIngest(195.5, {
    rawText: '₹19,550 / quintal',
    explicitUnit: 'INR/kg',
    valuesAlreadyNormalized: true,
  })

  assert.equal(result.originalUnit, 'quintal')
  assert.equal(result.normalizedUnit, 'kg')
  assert.equal(result.valuesAlreadyNormalized, true)
})
