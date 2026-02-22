'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '../../src/services/api-client'

type PricePoint = { observedAt: string; priceInrPerKg: string }

export default function DashboardPage() {
  const [data, setData] = useState<PricePoint[]>([])

  useEffect(() => {
    apiRequest<PricePoint[]>('/market-intelligence/arabica/chart')
      .then(setData)
      .catch(() => setData([]))
  }, [])

  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: 24 }}>
      <h1>Market Intelligence</h1>
      <p>Chart-ready historical series from backend.</p>
      <pre>{JSON.stringify(data.slice(-10), null, 2)}</pre>
    </main>
  )
}
