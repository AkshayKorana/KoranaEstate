'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '../../src/services/api-client'

export default function StorePage() {
  const [products, setProducts] = useState<unknown[]>([])

  useEffect(() => {
    apiRequest('/store/products').then((d) => setProducts(d as unknown[])).catch(() => setProducts([]))
  }, [])

  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: 24 }}>
      <h1>Store</h1>
      <pre>{JSON.stringify(products, null, 2)}</pre>
    </main>
  )
}
