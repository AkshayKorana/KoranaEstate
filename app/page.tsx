'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import Hero from './components/Hero'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)
const Line = dynamic(() => import('react-chartjs-2').then(mod => mod.Line), { ssr: false })

interface Commodity { name: string; variety?: string; price?: number; location?: string; source?: string; historicalPrices?: { date: string; price: number }[] }
interface APIResponse { data: Commodity[]; insights: Record<string, string> }
interface MarketplaceItem { id: string; name: string; type: string; price: number; quantity: number; location?: string }

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'Marketplace'|'Dashboard'>('Marketplace')
  const [items] = useState<MarketplaceItem[]>([
    { id:'1', name:'Arabica Coffee', type:'Coffee', price:520, quantity:50, location:'Coorg' },
    { id:'2', name:'Robusta Coffee', type:'Coffee', price:450, quantity:30, location:'Chikmagalur' },
    { id:'3', name:'Pepper', type:'Spice', price:650, quantity:20, location:'Kerala' },
    { id:'4', name:'Cardamom', type:'Spice', price:1200, quantity:15, location:'Kerala' },
  ])
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [insights, setInsights] = useState<Record<string,string>>({})
  const [selectedCommodity, setSelectedCommodity] = useState<Commodity|null>(null)

  useEffect(() => {
    async function fetchCommodities() {
      try {
        const res = await fetch(`/api/commodities`)
        const json: APIResponse = await res.json()
        setCommodities(json.data)
        setInsights(json.insights)
        if (json.data.length) setSelectedCommodity(json.data[0])
      } catch (err) { console.error(err) }
    }
    fetchCommodities()
  }, [])

  const historicalPrices = selectedCommodity?.historicalPrices ?? []

  return (
    <div className="space-y-12">
      <Navbar />

      {/* Hero Section */}
      <div className="pt-24">
        <Hero />
      </div>

      {/* Tabs */}
      <div className="container mx-auto px-6 space-y-6">
        <div className="flex space-x-4 border-b-2 border-gray-200">
          <button
            className={`px-5 py-2 font-semibold rounded-t-xl transition-all ${activeTab==='Marketplace'?'bg-white text-emerald-600 shadow-md border-t-4 border-emerald-500':'text-gray-500 hover:text-emerald-600'}`}
            onClick={()=>setActiveTab('Marketplace')}
          >Marketplace</button>
          <button
            className={`px-5 py-2 font-semibold rounded-t-xl transition-all ${activeTab==='Dashboard'?'bg-white text-purple-600 shadow-md border-t-4 border-purple-500':'text-gray-500 hover:text-purple-600'}`}
            onClick={()=>setActiveTab('Dashboard')}
          >AI / Commodity Dashboard</button>
        </div>

        {/* Marketplace Tab */}
        {activeTab==='Marketplace' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(item=>(
              <div key={item.id} className="bg-black/20 backdrop-blur-md p-6 rounded-2xl shadow-lg hover:shadow-2xl transition transform hover:-translate-y-1">
                <h3 className="text-xl font-bold text-white mb-1">{item.name}</h3>
                <span className="inline-block mb-2 px-3 py-1 text-sm font-medium bg-gradient-to-r from-green-400 to-green-600 text-white rounded-full">{item.type}</span>
                <p className="text-white/90 font-semibold">Price: ₹{item.price.toLocaleString()}</p>
                <p className="text-white/80">Qty: {item.quantity}</p>
                <p className="text-white/70">Location: {item.location || 'India'}</p>
                <div className="mt-4 flex gap-2">
                  <button className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow">Buy</button>
                  <button className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow">Sell</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab==='Dashboard' && selectedCommodity && (
          <section className="bg-gray-50 p-6 rounded-2xl shadow-lg space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Indian Commodity Dashboard</h2>
            <select className="border p-3 rounded-xl text-gray-700 font-medium"
              value={selectedCommodity.name}
              onChange={e=>setSelectedCommodity(commodities.find(c=>c.name===e.target.value)||null)}
            >
              {commodities.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
            </select>

            <div className="p-5 bg-white/80 rounded-2xl shadow-lg hover:shadow-2xl transition">
              <h3 className="font-bold text-xl text-gray-800">{selectedCommodity.name} {selectedCommodity.variety && `(${selectedCommodity.variety})`}</h3>
              <span className="inline-block mt-1 px-3 py-1 text-sm font-medium bg-gradient-to-r from-purple-300 to-purple-500 text-white rounded-full">{selectedCommodity.source||'Local Market'}</span>
              <p className="mt-2 text-gray-700 text-lg font-semibold">Current Price: ₹{selectedCommodity.price?.toLocaleString()||'-'}</p>
              <p className="text-gray-500 italic text-sm">AI Prediction: {insights[selectedCommodity.name]||'Loading...'}</p>

              {historicalPrices.length > 0 && (
                <div className="mt-5">
                  <Line
                    data={{
                      labels: historicalPrices.map(h=>new Date(h.date).toLocaleDateString()),
                      datasets:[{
                        label: `${selectedCommodity.name} Price (₹)`,
                        data: historicalPrices.map(h=>h.price),
                        borderColor:'rgb(139,92,246)',
                        backgroundColor:'rgba(139,92,246,0.2)',
                        tension:0.3
                      }]
                    }}
                    options={{responsive:true, plugins:{legend:{position:'top'}, title:{display:true,text:'Historical Price (Last 7 Days)'}}}}
                  />
                </div>
              )}
            </div>
          </section>
        )}
      </div>
      <Footer />
    </div>
  )
}
