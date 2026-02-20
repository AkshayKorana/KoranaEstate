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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/commodities')
        const json = await res.json()
        setCommodities(json.data)
        setInsights(json.insights)
        if (json.data.length) setSelected(json.data[0])
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="mt-8 p-8 rounded-2xl glass shadow-xl slide-in-up">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-emerald-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Header Card with Gradient */}
      <div className="p-8 rounded-2xl glass shadow-xl card-hover slide-in-up border-2 border-emerald-100">
        <div className="flex items-center space-x-4 mb-6">
          <div className="p-4 rounded-xl gradient-emerald-coffee float-animation">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-900 bg-clip-text text-transparent">
              Live Commodity Dashboard
            </h2>
            <p className="text-gray-600 mt-1">Track real-time coffee & spice market prices</p>
          </div>
        </div>

        <CommodityDropdown
          commodities={commodities}
          selected={selected}
          onChange={setSelected}
        />
      </div>

      {/* Chart and Insights */}
      {selected && (
        <div className="space-y-6 fade-in">
          {/* Chart Card */}
          <div className="p-8 rounded-2xl glass shadow-xl card-hover border-2 border-emerald-100">
            <CommodityChart commodity={selected} />
          </div>

          {/* Insights Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* AI Prediction Card */}
            <div className="p-6 rounded-2xl gradient-emerald text-white shadow-xl card-hover">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">AI Prediction</h3>
              </div>
              <p className="text-emerald-50 text-lg leading-relaxed">{insights[selected.name]}</p>
            </div>

            {/* Price Info Card */}
            <div className="p-6 rounded-2xl gradient-coffee-cream text-white shadow-xl card-hover">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold">Current Market</h3>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold">₹{selected.currentPrice.toFixed(2)}</p>
                <p className="text-sm text-white/80">Source: {selected.source}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selected && !isLoading && commodities.length === 0 && (
        <div className="p-12 rounded-2xl glass shadow-xl text-center">
          <div className="w-20 h-20 mx-auto mb-4 p-4 rounded-full bg-gray-100">
            <svg className="w-full h-full text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Data Available</h3>
          <p className="text-gray-500">Commodity data will appear here once available</p>
        </div>
      )}
    </div>
  )
}