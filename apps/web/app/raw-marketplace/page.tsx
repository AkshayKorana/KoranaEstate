'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { RawListing, RawListingFilters, CreateRawListingInput, CreateRawMarketplaceOrderInput, OrderCustomerDetails } from '@/types/marketplace'
import { useLanguage } from '@/app/language-context'
import { useEffectiveTheme } from '@/app/theme-context'
import { sendMarketplaceMessage } from '@/app/lib/send-marketplace-message'
import { extractErrorMessage, extractMessage } from '@/app/lib/api-errors'

const COMMODITIES = ['Arabica Cherry', 'Arabica Parchment', 'Robusta Cherry', 'Robusta Parchment', 'Cardamom', 'Arecanut', 'Pepper']
const RAW_ORDER_REQUIRED_FIELDS: Array<keyof OrderCustomerDetails> = ['fullName', 'mobileNumber', 'addressLine1', 'city', 'state', 'pincode']

function createEmptyCustomerDetails(fullName = ''): OrderCustomerDetails {
  return {
    fullName,
    mobileNumber: '',
    addressLine1: '',
    addressLine2: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    orderNote: '',
  }
}

export default function RawMarketplacePage() {
  const router = useRouter()
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated: () => router.replace('/auth'),
  })
  const { t } = useLanguage()
  const { isDark } = useEffectiveTheme()
  const [listings, setListings] = useState<RawListing[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [showCodModal, setShowCodModal] = useState(false)
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
  const [codOrderData, setCodOrderData] = useState<CreateRawMarketplaceOrderInput>({
    listingId: '',
    quantityKg: 0,
    customer: createEmptyCustomerDetails(),
  })
  const [codErrors, setCodErrors] = useState<Partial<Record<keyof OrderCustomerDetails | 'quantityKg' | 'form', string>>>({})
  const [submittingCod, setSubmittingCod] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchListings()
  }, [status, filters])

  if (status === 'loading') {
    return null
  }

  async function fetchListings() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filters.commodity) params.set('commodity', filters.commodity)
      if (filters.location) params.set('location', filters.location)
      
      const res = await fetch(`/api/raw/listings?${params}`)
      if (!res.ok) {
        console.error('Failed to fetch listings:', await extractErrorMessage(res))
        return
      }
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
        setFormData({ commodity: COMMODITIES[0], quantityKg: 0, pricePerKg: 0, location: '', grade: '', description: '' })
        fetchListings()
      } else {
        alert((await extractErrorMessage(res)) || t('Failed to create listing', 'ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ'))
      }
    } catch (error) {
      console.error('Error creating listing:', error)
      alert(t('Failed to create listing', 'ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ'))
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
        alert(t('Offer submitted successfully!', 'ಆಫರ್ ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಸಲಾಗಿದೆ!'))
      } else {
        alert((await extractErrorMessage(res)) || t('Failed to create offer', 'ಆಫರ್ ಸಲ್ಲಿಸಲು ವಿಫಲವಾಗಿದೆ'))
      }
    } catch (error) {
      console.error('Error creating offer:', error)
      alert(t('Failed to create offer', 'ಆಫರ್ ಸಲ್ಲಿಸಲು ವಿಫಲವಾಗಿದೆ'))
    }
  }

  async function handlePlaceCodOrder(e: React.FormEvent) {
    e.preventDefault()
    if (status !== 'authenticated') {
      router.push('/auth')
      return
    }

    if (!selectedListing) return

    const nextErrors: Partial<Record<keyof OrderCustomerDetails | 'quantityKg' | 'form', string>> = {}
    if (codOrderData.quantityKg <= 0) {
      nextErrors.quantityKg = t('Quantity must be greater than zero', 'ಪ್ರಮಾಣ ಶೂನ್ಯಕ್ಕಿಂತ ಹೆಚ್ಚಿರಬೇಕು')
    } else if (codOrderData.quantityKg > selectedListing.quantityKg) {
      nextErrors.quantityKg = `${t('Available quantity is', 'ಲಭ್ಯ ಪ್ರಮಾಣ')} ${selectedListing.quantityKg} kg`
    }

    for (const field of RAW_ORDER_REQUIRED_FIELDS) {
      if (!codOrderData.customer[field]?.trim()) {
        nextErrors[field] = t('This field is required', 'ಈ ಕ್ಷೇತ್ರ ಕಡ್ಡಾಯವಾಗಿದೆ')
      }
    }

    if (codOrderData.customer.mobileNumber && !/^[6-9]\d{9}$/.test(codOrderData.customer.mobileNumber.trim())) {
      nextErrors.mobileNumber = t('Enter a valid 10-digit mobile number', 'ಮಾನ್ಯ 10 ಅಂಕೆಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ')
    }
    if (codOrderData.customer.pincode && !/^\d{6}$/.test(codOrderData.customer.pincode.trim())) {
      nextErrors.pincode = t('Enter a valid 6-digit pincode', 'ಮಾನ್ಯ 6 ಅಂಕೆಯ ಪಿನ್‌ಕೋಡ್ ನಮೂದಿಸಿ')
    }

    setCodErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      setSubmittingCod(true)
      const res = await fetch('/api/raw/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(codOrderData),
      })
      const data = await res.json()

      if (!res.ok) {
        setCodErrors((current) => ({
          ...current,
          form: extractMessage(data) || t('Failed to place COD request', 'COD ವಿನಂತಿಯನ್ನು ಸಲ್ಲಿಸಲು ವಿಫಲವಾಗಿದೆ'),
        }))
        return
      }

      if (!data?.order?.id) {
        setCodErrors((current) => ({
          ...current,
          form: t('Order was created but confirmation could not be loaded.', 'ಆರ್ಡರ್ ರಚಿಸಲಾಗಿದೆ ಆದರೆ ದೃಢೀಕರಣವನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.'),
        }))
        return
      }

      setShowCodModal(false)
      setCodOrderData({
        listingId: '',
        quantityKg: 0,
        customer: createEmptyCustomerDetails(session?.user?.name || ''),
      })
      setCodErrors({})
      router.push(`/orders/${data.order.id}`)
    } catch (error) {
      console.error('Error placing COD request:', error)
      setCodErrors((current) => ({
        ...current,
        form: t('Failed to place COD request', 'COD ವಿನಂತಿಯನ್ನು ಸಲ್ಲಿಸಲು ವಿಫಲವಾಗಿದೆ'),
      }))
    } finally {
      setSubmittingCod(false)
    }
  }

  async function handleOpenConversation(listing: RawListing, withIntro: boolean) {
    if (status !== 'authenticated') {
      router.push('/auth')
      return
    }

    if (!listing.sellerId) {
      alert(t('Seller details unavailable', 'ಮಾರಾಟಗಾರ ವಿವರಗಳು ಲಭ್ಯವಿಲ್ಲ'))
      return
    }

    try {
      await sendMarketplaceMessage({
        recipientId: listing.sellerId,
        listingId: listing.id,
        listingName: `${listing.commodity}${listing.grade ? ` (${listing.grade})` : ''}`,
        kind: 'raw',
        action: withIntro ? 'contact' : 'message',
        router,
      })
    } catch (error) {
      console.error('Failed to open conversation:', error)
      alert(t('Failed to connect with seller', 'ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಲು ವಿಫಲವಾಗಿದೆ'))
    }
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
        {/* Header */}
        <div className="mb-8 slide-in-up">
          <div className="flex items-center space-x-4 mb-3">
            <div className="p-4 rounded-2xl gradient-brand-spectrum float-animation">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-luxe text-5xl font-bold text-brand-spectrum">
                {t('Raw Commodity Marketplace', 'ರಾ ಕಮೋಡಿಟಿ ಮಾರುಕಟ್ಟೆ')}
              </h1>
              <p className={`mt-2 text-lg ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>{t('Buy and sell raw coffee, pepper, cardamom, and arecanut directly from farmers 🌱', 'ರೈತರಿಂದ ನೇರವಾಗಿ ರಾ ಕಾಫಿ, ಮೆಣಸು, ಏಲಕ್ಕಿ ಮತ್ತು ಅಡಿಕೆ ಖರೀದಿ/ಮಾರಾಟ ಮಾಡಿ 🌱')}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          <aside className="w-72 flex-shrink-0 fade-in">
            <div className={`glass rounded-2xl shadow-lg p-6 sticky top-36 border ${isDark ? 'border-emerald-200/30' : 'border-black/10'}`}>
              <div className="flex items-center space-x-2 mb-6">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <h2 className="font-luxe font-bold text-2xl text-brand-spectrum">{t('Filters', 'ಫಿಲ್ಟರ್‌ಗಳು')}</h2>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-[#dbcdbb]' : 'text-[#2f2f2f]'}`}>🌾 {t('Commodity', 'ವಸ್ತು')}</label>
                  <select
                    className="lux-input w-full rounded-xl px-4 py-3 transition-all"
                    value={filters.commodity || ''}
                    onChange={(e) => setFilters({ ...filters, commodity: e.target.value || undefined })}
                  >
                    <option value="">{t('All Commodities', 'ಎಲ್ಲಾ ವಸ್ತುಗಳು')}</option>
                    {COMMODITIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-[#dbcdbb]' : 'text-[#2f2f2f]'}`}>📍 {t('Location', 'ಸ್ಥಳ')}</label>
                  <input
                    type="text"
                    className="lux-input w-full rounded-xl px-4 py-3 transition-all"
                    placeholder={t('City or region', 'ನಗರ ಅಥವಾ ಪ್ರದೇಶ')}
                    value={filters.location || ''}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value || undefined })}
                  />
                </div>

                <button
                  onClick={() => setFilters({})}
                  className="w-full text-sm lux-btn-primary px-4 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  {t('Clear All Filters', 'ಎಲ್ಲಾ ಫಿಲ್ಟರ್‌ಗಳನ್ನು ತೆರವುಗೊಳಿಸಿ')}
                </button>
              </div>

              {/* Stats Card */}
              <div className="mt-6 pt-6 border-t border-emerald-200/25">
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-600">{listings.length}</p>
                  <p className={`text-sm mt-1 ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>{t('Active Listings', 'ಸಕ್ರಿಯ ಲಿಸ್ಟಿಂಗ್‌ಗಳು')}</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Listings Grid */}
          <main className="flex-1">
            <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 slide-in-up">
              <p className={`font-medium ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>
                {loading
                  ? t('Loading...', 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...')
                  : `${listings.length} ${listings.length === 1 ? t('listing', 'ಲಿಸ್ಟಿಂಗ್') : t('listings', 'ಲಿಸ್ಟಿಂಗ್‌ಗಳು')} ${t('found', 'ಕಂಡುಬಂದವು')}`}
              </p>
              <button
                onClick={() => {
                  if (status !== 'authenticated') {
                    router.push('/auth')
                  } else {
                    setShowCreateModal(true)
                  }
                }}
                className="lux-btn-primary px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>{t('List Your Product', 'ನಿಮ್ಮ ಉತ್ಪನ್ನವನ್ನು ಲಿಸ್ಟ್ ಮಾಡಿ')}</span>
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20 glass rounded-2xl shadow-xl">
                <div className="flex justify-center space-x-2 mb-4">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-3 h-3 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-3 h-3 bg-emerald-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className={`font-medium ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>{t('Loading marketplace...', 'ಮಾರುಕಟ್ಟೆ ಲೋಡ್ ಆಗುತ್ತಿದೆ...')}</p>
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-20 glass rounded-2xl shadow-xl fade-in">
                <div className="w-24 h-24 mx-auto mb-6 p-6 rounded-full gradient-emerald-coffee float-animation">
                  <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-2 text-card-strong">{t('No Listings Yet', 'ಇನ್ನೂ ಲಿಸ್ಟಿಂಗ್‌ಗಳಿಲ್ಲ')}</h3>
                <p className={`mb-6 ${isDark ? 'text-[#bbae9a]' : 'text-[#4a4a4a]'}`}>{t('Be the first to list your commodity!', 'ನಿಮ್ಮ ವಸ್ತುವನ್ನು ಮೊದಲು ಲಿಸ್ಟ್ ಮಾಡಿ!')}</p>
                <button
                  onClick={() => status === 'authenticated' ? setShowCreateModal(true) : router.push('/auth')}
                  className="lux-btn-primary px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all inline-flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{t('Create First Listing', 'ಮೊದಲ ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಿ')}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {listings.map((listing, idx) => (
                  <div 
                    key={listing.id} 
                    className="surface-card rounded-2xl shadow-lg hover:shadow-2xl transition-all p-6 card-hover fade-in"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-xl text-card-strong">{listing.commodity}</h3>
                        <p className="text-sm mt-1 text-muted-safe">📍 {listing.location}</p>
                      </div>
                      {listing.grade && (
                        <span className="gradient-brand-spectrum text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-md">
                          {listing.grade}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-3 mb-5">
                      <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50">
                        <span className={`text-sm font-medium ${isDark ? 'text-[#e0e0e0]' : 'text-[#444444]'}`}>{t('Price', 'ಬೆಲೆ')}</span>
                        <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-emerald-600'}`}>₹{listing.pricePerKg}/kg</span>
                      </div>
                      <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50">
                        <span className={`text-sm font-medium ${isDark ? 'text-[#e0e0e0]' : 'text-[#444444]'}`}>{t('Quantity', 'ಪ್ರಮಾಣ')}</span>
                        <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-amber-700'}`}>{listing.quantityKg} kg</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-safe">
                        <div className="w-8 h-8 rounded-full gradient-coffee-cream flex items-center justify-center text-white font-bold text-xs">
                          {listing.seller?.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <span className="font-medium">{listing.seller?.name || t('Unknown Seller', 'ಅಪರಿಚಿತ ಮಾರಾಟಗಾರ')}</span>
                      </div>
                    </div>

                    {listing.description && (
                      <p className="text-sm mb-4 line-clamp-2 text-muted-safe">{listing.description}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSelectedListing(listing)
                          setOfferData({ offerPrice: listing.pricePerKg, quantity: Math.min(50, listing.quantityKg), message: '' })
                          setShowOfferModal(true)
                        }}
                        className="w-full gradient-brand-spectrum text-white py-3 rounded-xl font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{t('Make Offer', 'ಆಫರ್ ಮಾಡಿ')}</span>
                      </button>
                      <button
                        onClick={() => handleOpenConversation(listing, false)}
                        className="w-full lux-btn-secondary py-3 rounded-xl font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>{t('Message', 'ಸಂದೇಶ')}</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedListing(listing)
                          setCodOrderData({
                            listingId: listing.id,
                            quantityKg: Math.min(50, listing.quantityKg),
                            customer: createEmptyCustomerDetails(session?.user?.name || ''),
                          })
                          setCodErrors({})
                          setShowCodModal(true)
                        }}
                        className="w-full gradient-brand-spectrum text-white py-3 rounded-xl font-semibold shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{t('Place COD Order', 'COD ಆರ್ಡರ್ ಮಾಡಿ')}</span>
                      </button>
                    </div>
                    <button
                      onClick={() => handleOpenConversation(listing, true)}
                      className="mt-2 w-full lux-btn-secondary py-2.5 rounded-xl font-semibold transition-all"
                    >
                      {t('Contact Seller', 'ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಿ')}
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
          <div className="surface-card rounded-3xl max-w-lg w-full p-8 shadow-2xl slide-in-up">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 rounded-xl gradient-emerald">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
                {t('Create New Listing', 'ಹೊಸ ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಿ')}
              </h2>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Commodity', 'ವಸ್ತು')} *</label>
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
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Grade (optional)', 'ಗ್ರೇಡ್ (ಐಚ್ಛಿಕ)')}</label>
                <input
                  type="text"
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  placeholder={t('e.g., A, AA, Premium', 'ಉದಾ., A, AA, ಪ್ರೀಮಿಯಂ')}
                  value={formData.grade || ''}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Quantity (kg)', 'ಪ್ರಮಾಣ (ಕೆಜಿ)')} *</label>
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
                  <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Price (₹/kg)', 'ಬೆಲೆ (₹/ಕೆಜಿ)')} *</label>
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
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Location', 'ಸ್ಥಳ')} *</label>
                <input
                  required
                  type="text"
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  placeholder={t('City or region', 'ನಗರ ಅಥವಾ ಪ್ರದೇಶ')}
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Description (optional)', 'ವಿವರಣೆ (ಐಚ್ಛಿಕ)')}</label>
                <textarea
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  rows={3}
                  placeholder={t('Additional details about your product...', 'ನಿಮ್ಮ ಉತ್ಪನ್ನದ ಹೆಚ್ಚುವರಿ ವಿವರಗಳು...')}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all"
                >
                  {t('Cancel', 'ರದ್ದುಮಾಡಿ')}
                </button>
                <button
                  type="submit"
                  className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  {t('Create Listing', 'ಲಿಸ್ಟಿಂಗ್ ರಚಿಸಿ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Make Offer Modal */}
      {showOfferModal && selectedListing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="surface-card rounded-3xl max-w-lg w-full p-8 shadow-2xl slide-in-up">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 rounded-xl gradient-coffee-cream">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
                  {t('Make an Offer', 'ಆಫರ್ ನೀಡಿ')}
                </h2>
                <p className="text-muted-safe text-sm">{selectedListing.commodity} - {selectedListing.location}</p>
              </div>
            </div>

            <form onSubmit={handleMakeOffer} className="space-y-5">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200">
                <p className="text-sm font-medium text-muted-safe mb-1">{t("Seller's Asking Price", 'ಮಾರಾಟಗಾರರ ಕೇಳುವ ಬೆಲೆ')}</p>
                <p className="text-2xl font-bold text-emerald-600">₹{selectedListing.pricePerKg}/kg</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Your Offer Price (₹/kg)', 'ನಿಮ್ಮ ಆಫರ್ ಬೆಲೆ (₹/ಕೆಜಿ)')} *</label>
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
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Quantity (kg)', 'ಪ್ರಮಾಣ (ಕೆಜಿ)')} *</label>
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
                <p className="text-xs text-muted-safe mt-1">{t('Available', 'ಲಭ್ಯ')}: {selectedListing.quantityKg} kg</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#111111] dark:text-[#ffffff] mb-2">{t('Message (optional)', 'ಸಂದೇಶ (ಐಚ್ಛಿಕ)')}</label>
                <textarea
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                  rows={3}
                  placeholder={t('Add a message to the seller...', 'ಮಾರಾಟಗಾರರಿಗೆ ಸಂದೇಶ ಸೇರಿಸಿ...')}
                  value={offerData.message}
                  onChange={(e) => setOfferData({ ...offerData, message: e.target.value })}
                />
              </div>

              <div className="p-6 rounded-xl gradient-emerald-coffee">
                <p className="text-white/80 text-sm mb-1">{t('Total Offer Amount', 'ಒಟ್ಟು ಆಫರ್ ಮೊತ್ತ')}</p>
                <p className="text-3xl font-bold text-white">₹{(offerData.offerPrice * offerData.quantity).toFixed(2)}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOfferModal(false)}
                  className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all"
                >
                  {t('Cancel', 'ರದ್ದುಮಾಡಿ')}
                </button>
                <button
                  type="submit"
                  className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                  {t('Submit Offer', 'ಆಫರ್ ಸಲ್ಲಿಸಿ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCodModal && selectedListing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in">
          <div className="surface-card rounded-3xl max-w-4xl w-full p-8 shadow-2xl slide-in-up max-h-[92vh] overflow-y-auto">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 rounded-xl gradient-brand-spectrum">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
                  {t('Confirm COD Request', 'COD ವಿನಂತಿ ದೃಢೀಕರಿಸಿ')}
                </h2>
                <p className="text-muted-safe text-sm">{selectedListing.commodity}{selectedListing.grade ? ` • ${selectedListing.grade}` : ''}</p>
              </div>
            </div>

            <form onSubmit={handlePlaceCodOrder} className="space-y-6">
              <section className="surface-app-panel rounded-2xl p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-app-strong">{selectedListing.commodity}</h3>
                      {selectedListing.grade ? (
                        <span className="surface-app-chip rounded-full px-3 py-1 text-xs font-semibold">{selectedListing.grade}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-app-muted">
                      {selectedListing.seller?.name ? `${t('Seller', 'ಮಾರಾಟಗಾರ')}: ${selectedListing.seller.name}` : t('Seller details available after confirmation', 'ಮಾರಾಟಗಾರರ ವಿವರಗಳು ದೃಢೀಕರಣದ ನಂತರ ಲಭ್ಯವಾಗುತ್ತವೆ')}
                    </p>
                    <p className="mt-1 text-sm text-app-soft">📍 {selectedListing.location || t('Location not specified', 'ಸ್ಥಳ ನಮೂದಿಸಲಾಗಿಲ್ಲ')}</p>
                    {selectedListing.description ? <p className="mt-3 text-sm text-app-muted">{selectedListing.description}</p> : null}
                  </div>
                  <div className="grid gap-3 min-w-[230px]">
                    <div className="surface-app-panel-soft rounded-xl p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-soft">{t('Price', 'ಬೆಲೆ')}</p>
                      <p className="mt-2 text-2xl font-bold text-app-strong">₹{selectedListing.pricePerKg}/kg</p>
                    </div>
                    <div className="surface-app-panel-soft rounded-xl p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-app-soft">{t('Available quantity', 'ಲಭ್ಯ ಪ್ರಮಾಣ')}</p>
                      <p className="mt-2 text-2xl font-bold text-app-strong">{selectedListing.quantityKg} kg</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="surface-app-panel rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-lg font-bold text-app-strong">{t('Order details', 'ಆರ್ಡರ್ ವಿವರಗಳು')}</h3>
                    <p className="mt-1 text-sm text-app-muted">{t('Choose your required quantity and confirm your COD request.', 'ನಿಮ್ಮ ಅಗತ್ಯ ಪ್ರಮಾಣವನ್ನು ಆಯ್ಕೆಮಾಡಿ ಮತ್ತು COD ವಿನಂತಿಯನ್ನು ದೃಢೀಕರಿಸಿ.')}</p>
                  </div>
                  <div className="surface-app-chip rounded-full px-4 py-2 text-sm font-semibold">CASH ON DELIVERY</div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Required quantity (kg)', 'ಅಗತ್ಯ ಪ್ರಮಾಣ (ಕೆಜಿ)')} *</label>
                    <input
                      type="number"
                      min="0.1"
                      max={selectedListing.quantityKg}
                      step="0.1"
                      className="surface-app-input w-full rounded-xl px-4 py-3 text-lg font-semibold"
                      value={codOrderData.quantityKg || ''}
                      onChange={(e) => {
                        const nextValue = Number(e.target.value)
                        setCodOrderData({ ...codOrderData, quantityKg: Number.isFinite(nextValue) ? nextValue : 0 })
                        setCodErrors((current) => ({ ...current, quantityKg: undefined, form: undefined }))
                      }}
                    />
                    <p className="mt-2 text-xs text-app-soft">{t('Available', 'ಲಭ್ಯ')}: {selectedListing.quantityKg} kg</p>
                    {codErrors.quantityKg ? <p className="mt-2 text-sm font-medium text-red-600">{codErrors.quantityKg}</p> : null}
                  </div>
                  <div className="surface-app-panel-soft rounded-xl p-4">
                    <p className="text-sm font-semibold text-app-strong">CASH ON DELIVERY</p>
                    <p className="mt-1 text-sm text-app-muted">{t('Seller will confirm availability before fulfillment if required.', 'ಅಗತ್ಯವಿದ್ದರೆ ಪೂರೈಕೆಗೆ ಮೊದಲು ಮಾರಾಟಗಾರ ಲಭ್ಯತೆಯನ್ನು ದೃಢೀಕರಿಸುತ್ತಾರೆ.')}</p>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between text-app-muted">
                        <span>{t('Price per kg', 'ಪ್ರತಿ ಕೆಜಿ ಬೆಲೆ')}</span>
                        <span className="font-semibold text-app-body">₹{selectedListing.pricePerKg}</span>
                      </div>
                      <div className="flex justify-between text-app-muted">
                        <span>{t('Requested quantity', 'ಕೋರಿದ ಪ್ರಮಾಣ')}</span>
                        <span className="font-semibold text-app-body">{codOrderData.quantityKg || 0} kg</span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-200/80 pt-3 text-app-body dark:border-white/10">
                        <span className="font-semibold">{t('Estimated total', 'ಅಂದಾಜು ಒಟ್ಟು')}</span>
                        <span className="text-xl font-bold">₹{((codOrderData.quantityKg || 0) * selectedListing.pricePerKg).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="surface-app-panel rounded-2xl p-5">
                <h3 className="text-lg font-bold text-app-strong">{t('Buyer details', 'ಖರೀದಿದಾರರ ವಿವರಗಳು')}</h3>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Full name', 'ಪೂರ್ಣ ಹೆಸರು')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={codOrderData.customer.fullName}
                      onChange={(e) => {
                        setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, fullName: e.target.value } })
                        setCodErrors((current) => ({ ...current, fullName: undefined, form: undefined }))
                      }}
                    />
                    {codErrors.fullName ? <p className="mt-2 text-sm font-medium text-red-600">{codErrors.fullName}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Mobile number', 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      inputMode="numeric"
                      maxLength={10}
                      value={codOrderData.customer.mobileNumber}
                      onChange={(e) => {
                        setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, mobileNumber: e.target.value.replace(/\D/g, '').slice(0, 10) } })
                        setCodErrors((current) => ({ ...current, mobileNumber: undefined, form: undefined }))
                      }}
                    />
                    {codErrors.mobileNumber ? <p className="mt-2 text-sm font-medium text-red-600">{codErrors.mobileNumber}</p> : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Delivery address', 'ವಿತರಣಾ ವಿಳಾಸ')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={codOrderData.customer.addressLine1}
                      onChange={(e) => {
                        setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, addressLine1: e.target.value } })
                        setCodErrors((current) => ({ ...current, addressLine1: undefined, form: undefined }))
                      }}
                    />
                    {codErrors.addressLine1 ? <p className="mt-2 text-sm font-medium text-red-600">{codErrors.addressLine1}</p> : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Address line 2', 'ವಿಳಾಸ ಸಾಲು 2')}</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={codOrderData.customer.addressLine2 || ''}
                      onChange={(e) => setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, addressLine2: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Landmark', 'ಲ್ಯಾಂಡ್‌ಮಾರ್ಕ್')}</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={codOrderData.customer.landmark || ''}
                      onChange={(e) => setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, landmark: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('City / town', 'ನಗರ / ಪಟ್ಟಣ')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={codOrderData.customer.city}
                      onChange={(e) => {
                        setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, city: e.target.value } })
                        setCodErrors((current) => ({ ...current, city: undefined, form: undefined }))
                      }}
                    />
                    {codErrors.city ? <p className="mt-2 text-sm font-medium text-red-600">{codErrors.city}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('State', 'ರಾಜ್ಯ')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      value={codOrderData.customer.state}
                      onChange={(e) => {
                        setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, state: e.target.value } })
                        setCodErrors((current) => ({ ...current, state: undefined, form: undefined }))
                      }}
                    />
                    {codErrors.state ? <p className="mt-2 text-sm font-medium text-red-600">{codErrors.state}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Pincode', 'ಪಿನ್‌ಕೋಡ್')} *</label>
                    <input
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      inputMode="numeric"
                      maxLength={6}
                      value={codOrderData.customer.pincode}
                      onChange={(e) => {
                        setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) } })
                        setCodErrors((current) => ({ ...current, pincode: undefined, form: undefined }))
                      }}
                    />
                    {codErrors.pincode ? <p className="mt-2 text-sm font-medium text-red-600">{codErrors.pincode}</p> : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-app-body mb-2">{t('Buyer note', 'ಖರೀದಿದಾರರ ಟಿಪ್ಪಣಿ')}</label>
                    <textarea
                      className="surface-app-input w-full rounded-xl px-4 py-3"
                      rows={3}
                      value={codOrderData.customer.orderNote || ''}
                      onChange={(e) => setCodOrderData({ ...codOrderData, customer: { ...codOrderData.customer, orderNote: e.target.value } })}
                    />
                  </div>
                </div>
              </section>

              {codErrors.form ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {codErrors.form}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !submittingCod && setShowCodModal(false)}
                  className="surface-button-secondary flex-1 py-3 rounded-xl font-semibold transition-all"
                >
                  {t('Cancel', 'ರದ್ದುಮಾಡಿ')}
                </button>
                <button
                  type="submit"
                  disabled={submittingCod}
                  className="flex-1 gradient-emerald text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submittingCod ? t('Submitting...', 'ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...') : t('Confirm COD Request', 'COD ವಿನಂತಿ ದೃಢೀಕರಿಸಿ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
