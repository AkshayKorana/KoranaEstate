'use client'

import { useEffect, useState } from 'react'
import { marketplaceService } from '../../src/services/marketplace.service'

export default function MarketplacePage() {
  const [listings, setListings] = useState<unknown[]>([])

  useEffect(() => {
    marketplaceService.list().then((result) => setListings(result as unknown[])).catch(() => setListings([]))
  }, [])

  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: 24 }}>
      <h1>Raw Marketplace</h1>
      <pre>{JSON.stringify(listings, null, 2)}</pre>
    </main>
  )
}
