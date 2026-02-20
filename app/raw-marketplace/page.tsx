'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { RawListing, RawListingFilters, CreateRawListingInput } from '@/types/marketplace'
import Navbar from '@/app/components/Navbar'

const COMMODITIES = ['Arabica Cherry', 'Arabica Parchment', 'Robusta Cherry', 'Robusta Parchment', 'Cardamom', 'Arecanut', 'Pepper']

export default function RawMarketplacePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [listings, setListings] = useState<RawListing[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [selectedListing, setSelectedListing] = useState<RawListing | null>(null)
  const [filters, setFilters] = useState<RawListingFilters>({})

  // Form states
  const [formData, setFormData] = useState<CreateRawListingInput>({
    commodity: COMMODITIES[0],
    quantityKg: 0,
    pricePerKg: 0,
    location: ''
  })
  const [offerData, setOfferData] = useState({ offerPrice: 0, quantity: 0, message: '' })

  useEffect(() => {
    fetchListings()
  }, [filters])

  async function fetchListings() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.commodity) params.set('commodity', filters.commodity)
      if (filters.location) params.set('location', filters.location)
      
      const res = await fetch(`/api/raw/listings?${params}`)
      const data = await res.json()
      setListings(data.listings || [])
    } catch (error) {
      console.error('Failed to fetch listings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'authenticated') {
      router.push('/auth')
      return
    }

    try {
      const res = await fetch('/api/raw/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setShowCreateModal(false)
        setFormData({ commodity: COMMODITIES[0], quantityKg: 0, pricePerKg: 0, location: '' })
        fetchListings()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create listing')
      }
    } catch (error) {
      console.error('Error creating listing:', error)
      alert('Failed to create listing')
    }
  }

  async function handleMakeOffer(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'authenticated') {
      router.push('/auth')
      return
    }

    if (!selectedListing) return

    try {
      const res = await fetch('/api/raw/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: selectedListing.id,
          ...offerData
        })
      })

      if (res.ok) {
        setShowOfferModal(false)
        setOfferData({ offerPrice: 0, quantity: 0, message: '' })
        alert('Offer submitted successfully!')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create offer')
      }
    } catch (error) {
      console.error('Error creating offer:', error)
      alert('Failed to create offer')
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-12">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 slide-in-up">
          <div className="flex items-center space-x-4 mb-3">
            <div className="p-4 rounded-2xl gradient-emerald-coffee float-animation">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-green-600 to-amber-700 bg-clip-text text-transparent">
                Raw Commodity Marketplace
              </h1>
              <p className="mt-2 text-gray-600 text-lg">Buy and sell raw coffee, pepper, cardamom, and arecanut directly from farmers 🌱</p>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          <aside className="w-72 flex-shrink-0 fade-in">
            <div className="glass rounded-2xl shadow-xl p-6 sticky top-24 border-2 border-emerald-100">
              <div className="flex items-center space-x-2 mb-6">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <h2 className="font-bold text-xl bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">Filters</h2>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">🌾 Commodity</label>
                  <select
                    className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                    value={filters.commodity || ''}
                    onChange={(e) => setFilters({ ...filters, commodity: e.target.value || undefined })}
                  >
                    <option value="">All Commodities</option>
                    {COMMODITIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">📍 Location</label>
                  <input
                    type="text"
                    className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                    placeholder="City or region"
                    value={filters.location || ''}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value || undefined })}
                  />
                </div>

                <button
                  onClick={() => setFilters({})}
                  className="w-full text-sm gradient-emerald text-white px-4 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Clear All Filters
                </button>
              </div>

              {/* Stats Card */}
              <div className="mt-6 pt-6 border-t-2 border-emerald-100">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-600">{listings.length}</p>
                  <p className="text-sm text-gray-600 mt-1">Active Listings</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Listings Grid */}
          <main className="flex-1">
            <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 slide-in-up">
              <p className="text-gray-600 font-medium">
                {loading ? 'Loading...' : `${listings.length} ${listings.length === 1 ? 'listing' : 'listings'} found`}
              </p>
              <button
                onClick={() => {
                  if (status !== 'authenticated') {
                    router.push('/auth')
                  } else {
                    setShowCreateModal(true)
                  }
                }}
                className="gradient-emerald text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>List Your Product</span>
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20 glass rounded-2xl shadow-xl">
                <div className="flex justify-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-3 h-3 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-3 h-3 bg-emerald-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className="text-gray-600 font-medium">Loading marketplace...</p>
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-20 glass rounded-2xl shadow-xl fade-in">
                <div className="w-24 h-24 mx-auto mb-6 p-6 rounded-full gradient-emerald-coffee float-animation">
                  <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-700 mb-2">No Listings Yet</h3>
                <p className="text-gray-500 mb-6">Be the first to list your commodity!</p>
                <button
                  onClick={() => status === 'authenticated' ? setShowCreateModal(true) : router.push('/auth')}
                  className="gradient-emerald text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all inline-flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create First Listing</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing, idx) => (
                  <div 
                    key={listing.id} 
                    className="glass rounded-2xl shadow-lg hover:shadow-2xl transition-all p-6 border-2 border-emerald-100 card-hover fade-in"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-xl text-gray-800">{listing.commodity}</h3>
                        <p className="text-sm text-gray-500 mt-1">📍 {listing.location}</p>
                      </div>
                      {listing.grade && (
                        <span className="gradient-emerald text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-md">
                          {listing.grade}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-3 mb-5">
                      <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50">
                        <span className="text-sm font-medium text-gray-600">Price</span>
                        <span className="text-lg font-bold text-emerald-600">₹{listing.pricePerKg}/kg</span>
                      </div>
                      <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50">
                        <span className="text-sm font-medium text-gray-600">Quantity</span>
                        <span className="text-lg font-bold text-amber-700">{listing.quantityKg} kg</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <div className="w-8 h-8 rounded-full gradient-coffee-cream flex items-center justify-center text-white font-bold text-xs">
                          {listing.seller?.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <span className="font-medium">{listing.seller?.name || 'Unknown Seller'}</span>
                      </div>
                    </div>

                    {listing.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{listing.description}</p>
                    )}

                    <button
                      onClick={() => {
                        setSelectedListing(listing)
                        setOfferData({ offerPrice: listing.pricePerKg, quantity: Math.min(50, listing.quantityKg), message: '' })
                        setShowOfferModal(true)
                      }}
                      className="w-full gradient-emerald text-white py-3 rounded-xl font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Make Offer</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Create Listing Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="glass rounded-3xl max-w-lg w-full p-8 shadow-2xl border-2 border-emerald-100 slide-in-up">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-xl gradient-emerald">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
                Create New Listing
              </h2>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Commodity *</label>
                <select
                  required
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  value={formData.commodity}
                  onChange={(e) => setFormData({ ...formData, commodity: e.target.value })}
                >
                  {COMMODITIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Grade (optional)</label>
                <input
                  type="text"
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  placeholder="e.g., A, AA, Premium"
                  value={formData.grade || ''}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity (kg) *</label>
                  <input
                    required
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                    value={formData.quantityKg || ''}
                    onChange={(e) => setFormData({ ...formData, quantityKg: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Price (₹/kg) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                    value={formData.pricePerKg || ''}
                    onChange={(e) => setFormData({ ...formData, pricePerKg: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location *</label>
                <input
                  required
                  type="text"
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  placeholder="City or region"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description (optional)</label>
                <textarea
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  rows={3}
                  placeholder="Additional details about your product..."
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  Create Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Make Offer Modal */}
      {showOfferModal && selectedListing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="glass rounded-3xl max-w-lg w-full p-8 shadow-2xl border-2 border-emerald-100 slide-in-up">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 rounded-xl gradient-coffee-cream">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
                  Make an Offer
                </h2>
                <p className="text-gray-600 text-sm">{selectedListing.commodity} - {selectedListing.location}</p>
              </div>
            </div>

            <form onSubmit={handleMakeOffer} className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200">
                <p className="text-sm font-medium text-gray-600 mb-1">Seller's Asking Price</p>
                <p className="text-2xl font-bold text-emerald-600">₹{selectedListing.pricePerKg}/kg</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Your Offer Price (₹/kg) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all text-lg font-semibold"
                  value={offerData.offerPrice || ''}
                  onChange={(e) => setOfferData({ ...offerData, offerPrice: parseFloat(e.target.value) })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity (kg) *</label>
                <input
                  required
                  type="number"
                  min="0.1"
                  max={selectedListing.quantityKg}
                  step="0.1"
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all text-lg font-semibold"
                  value={offerData.quantity || ''}
                  onChange={(e) => setOfferData({ ...offerData, quantity: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-gray-500 mt-1">Available: {selectedListing.quantityKg} kg</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Message (optional)</label>
                <textarea
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  rows={3}
                  placeholder="Add a message to the seller..."
                  value={offerData.message}
                  onChange={(e) => setOfferData({ ...offerData, message: e.target.value })}
                />
              </div>

              <div className="p-6 rounded-xl gradient-emerald-coffee">
                <p className="text-white/80 text-sm mb-1">Total Offer Amount</p>
                <p className="text-3xl font-bold text-white">₹{(offerData.offerPrice * offerData.quantity).toFixed(2)}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOfferModal(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  Submit Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
