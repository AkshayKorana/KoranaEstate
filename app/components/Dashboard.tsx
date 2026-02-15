'use client'

import { useEffect, useState } from 'react'
import CommodityDropdown from './CommodityDropdown'
import CommodityChart from './CommodityChart'

type Commodity = {
  name: string
  currentPrice: number
  historicalPrices: { date: string; price: number }[]
  source: string
}

export default function Dashboard() {
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [selected, setSelected] = useState<Commodity | null>(null)
  const [insights, setInsights] = useState<Record<string, string>>({})

  useEffect(() => {
    async function fetchData() {
      const res = await fetch('/api/commodities')
      const json = await res.json()
      setCommodities(json.data)
      setInsights(json.insights)
      if (json.data.length) setSelected(json.data[0])
    }
    fetchData()
  }, [])

  return (
    <div className="mt-8 p-4 border rounded bg-white shadow">
      <h2 className="text-xl font-bold mb-4">Live Commodity Dashboard</h2>

      <CommodityDropdown
        commodities={commodities}
        selected={selected}
        onChange={setSelected}
      />

      {selected && (
        <div className="mt-6">
          <CommodityChart commodity={selected} />
          <p className="mt-2 font-medium">
            AI Prediction: {insights[selected.name]}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Current Price: {selected.currentPrice} | Source: {selected.source}
          </p>
        </div>
      )}
    </div>
  )
}