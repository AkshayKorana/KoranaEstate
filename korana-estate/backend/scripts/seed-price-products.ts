import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type SeedProduct = {
  productKey: string
  displayName: string
  unit: string
  defaultSource: string
  sourceUrl: string
  baselineValue: number
  volatilityPct: number
  displayOrder: number
}

const PRODUCTS: SeedProduct[] = [
  {
    productKey: 'arabica_cherry',
    displayName: 'Arabica Cherry',
    unit: 'INR/kg',
    defaultSource: 'Stub Deterministic Generator',
    sourceUrl: 'https://example.com/prices/arabica-cherry',
    baselineValue: 345,
    volatilityPct: 0.06,
    displayOrder: 1,
  },
  {
    productKey: 'arabica_parchment',
    displayName: 'Arabica Parchment',
    unit: 'INR/kg',
    defaultSource: 'Stub Deterministic Generator',
    sourceUrl: 'https://example.com/prices/arabica-parchment',
    baselineValue: 372,
    volatilityPct: 0.055,
    displayOrder: 2,
  },
  {
    productKey: 'robusta_cherry',
    displayName: 'Robusta Cherry',
    unit: 'INR/kg',
    defaultSource: 'Stub Deterministic Generator',
    sourceUrl: 'https://example.com/prices/robusta-cherry',
    baselineValue: 268,
    volatilityPct: 0.065,
    displayOrder: 3,
  },
  {
    productKey: 'robusta_parchment',
    displayName: 'Robusta Parchment',
    unit: 'INR/kg',
    defaultSource: 'Stub Deterministic Generator',
    sourceUrl: 'https://example.com/prices/robusta-parchment',
    baselineValue: 286,
    volatilityPct: 0.06,
    displayOrder: 4,
  },
  {
    productKey: 'arabica_greenbean',
    displayName: 'Arabica Green Bean',
    unit: 'INR/kg',
    defaultSource: 'Stub Deterministic Generator',
    sourceUrl: 'https://example.com/prices/arabica-greenbean',
    baselineValue: 418,
    volatilityPct: 0.05,
    displayOrder: 5,
  },
  {
    productKey: 'robusta_greenbean',
    displayName: 'Robusta Green Bean',
    unit: 'INR/kg',
    defaultSource: 'Stub Deterministic Generator',
    sourceUrl: 'https://example.com/prices/robusta-greenbean',
    baselineValue: 335,
    volatilityPct: 0.055,
    displayOrder: 6,
  },
]

async function run() {
  for (const product of PRODUCTS) {
    await prisma.priceProduct.upsert({
      where: { productKey: product.productKey },
      update: {
        displayName: product.displayName,
        unit: product.unit,
        defaultSource: product.defaultSource,
        sourceUrl: product.sourceUrl,
        baselineValue: product.baselineValue,
        volatilityPct: product.volatilityPct,
        displayOrder: product.displayOrder,
        enabled: true,
      },
      create: {
        ...product,
        enabled: true,
      },
    })
  }

  console.log(`Seeded ${PRODUCTS.length} price products.`)
}

run()
  .catch((error) => {
    console.error('seed-price-products failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
