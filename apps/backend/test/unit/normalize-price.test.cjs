const test = require('node:test')
const assert = require('node:assert/strict')
const {
  normalizePriceToKg,
  detectPriceUnit,
  normalizeDetectedPrice,
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
