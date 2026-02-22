'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/app/components/Navbar'
import { useLanguage } from '@/app/language-context'
import { useTheme } from '@/app/theme-context'
import type { User } from '@/types/marketplace'
import { LISTING_TYPES, UNITS, blockHasCategory, getEstateBlockBySlug } from '../blocks'

type EstateListing = {
  id: string
  sellerId: string
  title: string
  category: string
  subcategory?: string | null
  listingType: string
  price: number
  unit: string
  quantity?: number | null
  location: string
  description?: string | null
  contactPhone?: string | null
  isActive: boolean
  createdAt: string
  seller?: User
}

type CreateEstateListingInput = {
  title: string
  category: string
  subcategory: string
  listingType: string
  price: number | ''
  unit: string
  quantity: number | ''
  location: string
  description: string
  contactPhone: string
}

export default function EstateBlockPage() {
  const { t } = useLanguage()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const params = useParams<{ block: string }>()
  const router = useRouter()
  const { status } = useSession()

  const block = getEstateBlockBySlug(params?.block ?? '')

  const [listings, setListings] = useState<EstateListing[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formError, setFormError] = useState('')

  const [formData, setFormData] = useState<CreateEstateListingInput>({
    title: '',
    category: block?.createCategory ?? '',
    subcategory: '',
    listingType: block?.createType ?? 'Product',
    price: '',
    unit: UNITS[0],
    quantity: '',
    location: '',
    description: '',
    contactPhone: '',
  })

  const fetchListings = useCallback(async () => {
    if (!block) return

    try {
      setLoading(true)
      const res = await fetch('/api/estate/listings?limit=500', { cache: 'no-store' })
      const data = await res.json()
      const allListings: EstateListing[] = Array.isArray(data?.listings) ? data.listings : []
      setListings(allListings.filter((listing) => blockHasCategory(block, listing.category)))
    } catch {
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [block])

  useEffect(() => {
    void fetchListings()
  }, [fetchListings])

  useEffect(() => {
    if (!block) return
    setFormData((prev) => ({
      ...prev,
      category: block.createCategory,
      listingType: block.createType,
    }))
  }, [block])

  const title = useMemo(() => (block ? t(block.title, block.titleKn) : t('Service', 'ಸೇವೆ')), [block, t])

  if (!block) {
    return (
      <div className={`min-h-screen content-under-navbar pb-12 ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`}>
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-700 font-semibold">{t('Invalid service block.', 'ಅಮಾನ್ಯ ಸೇವಾ ವಿಭಾಗ.')}</p>
            <Link href="/estate-marketplace" className="mt-3 inline-block text-sm font-semibold text-emerald-700">
              {t('Back to Estate Essentials', 'ಎಸ್ಟೇಟ್ ಅವಶ್ಯಕತೆಗಳಿಗೆ ಹಿಂತಿರುಗಿ')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const activeBlock = block

  async function openConversation(listing: EstateListing, withIntro: boolean) {
    if (status !== 'authenticated') {
      router.push('/auth')
      return
    }

    const initialMessage = withIntro
      ? `Hi, I am interested in your listing: ${listing.title} (${listing.category}) at ₹${listing.price}/${listing.unit}.`
      : ''

    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: listing.sellerId, initialMessage }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to open chat')
        return
      }
      if (data.conversation?.id) {
        router.push(`/messages?conversationId=${encodeURIComponent(data.conversation.id)}`)
      }
    } catch {
      alert('Failed to open chat')
    }
  }

  async function handleCreateListing(e: FormEvent) {
    e.preventDefault()
    setFormError('')

    if (status !== 'authenticated') {
      router.push('/auth')
      return
    }

    const price = Number(formData.price)
    if (!Number.isFinite(price) || price <= 0) {
      setFormError('Please enter a valid price greater than 0')
      return
    }

    const payload = {
      ...formData,
      category: activeBlock.createCategory,
      listingType: formData.listingType,
      price,
      quantity: formData.quantity === '' ? null : Number(formData.quantity),
    }

    try {
      const res = await fetch('/api/estate/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const responseText = await res.text()
      let data: { error?: string } = {}
      try {
        data = responseText ? (JSON.parse(responseText) as { error?: string }) : {}
      } catch {
        data = { error: responseText || undefined }
      }

      if (!res.ok) {
        if (res.status === 401) {
          setFormError('Session expired. Please sign in again.')
          router.push('/auth')
          return
        }
        setFormError(data.error || `Failed to create estate listing (HTTP ${res.status})`)
        return
      }

      setShowCreateModal(false)
      setFormData({
        title: '',
        category: activeBlock.createCategory,
        subcategory: '',
        listingType: activeBlock.createType,
        price: '',
        unit: UNITS[0],
        quantity: '',
        location: '',
        description: '',
        contactPhone: '',
      })
      await fetchListings()
    } catch {
      setFormError('Failed to create estate listing')
    }
  }

  return (
    <div className={`min-h-screen content-under-navbar pb-12 ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`}>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-brand-spectrum">{title}</h1>
            <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t('View listings, add service, and chat with sellers.', 'ಪಟ್ಟಿಗಳನ್ನು ನೋಡಿ, ಸೇವೆ ಸೇರಿಸಿ, ಮಾರಾಟಗಾರರ ಜೊತೆ ಚಾಟ್ ಮಾಡಿ.')}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/estate-marketplace"
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${isDark ? 'border-slate-600 bg-slate-800 text-gray-200' : 'border-gray-300 bg-white text-gray-700'}`}
            >
              {t('Back', 'ಹಿಂತಿರುಗಿ')}
            </Link>
            <button
              type="button"
              onClick={() => {
                if (status !== 'authenticated') {
                  router.push('/auth')
                  return
                }
                setFormError('')
                setShowCreateModal(true)
              }}
              className="rounded-lg gradient-brand-spectrum px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              {t('+ Add Service', '+ ಸೇವೆ ಸೇರಿಸಿ')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className={`rounded-xl border p-6 ${isDark ? 'border-slate-700 bg-slate-900 text-gray-300' : 'border-gray-200 bg-white text-gray-600'}`}>{t('Loading services...', 'ಸೇವೆಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...')}</div>
        ) : listings.length === 0 ? (
          <div className={`rounded-xl border p-6 ${isDark ? 'border-slate-700 bg-slate-900 text-gray-300' : 'border-gray-200 bg-white text-gray-600'}`}>{t('No listings yet in this service.', 'ಈ ಸೇವೆಯಲ್ಲಿ ಇನ್ನೂ ಪಟ್ಟಿಗಳಿಲ್ಲ.')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((listing) => (
              <div key={listing.id} className={`rounded-2xl border p-5 shadow-sm space-y-3 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-bold text-lg leading-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{listing.title}</h3>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {listing.listingType}
                  </span>
                </div>

                <div className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  {listing.subcategory && <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('Sub:', 'ಉಪ:')}</span> {listing.subcategory}</p>}
                  <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('Price:', 'ಬೆಲೆ:')}</span> ₹{listing.price.toLocaleString('en-IN')} / {listing.unit}</p>
                  {listing.quantity != null && <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('Qty:', 'ಪ್ರಮಾಣ:')}</span> {listing.quantity}</p>}
                  <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('Location:', 'ಸ್ಥಳ:')}</span> {listing.location}</p>
                  <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('Seller:', 'ಮಾರಾಟಗಾರ:')}</span> {listing.seller?.name || listing.seller?.email || t('Seller', 'ಮಾರಾಟಗಾರ')}</p>
                  {listing.contactPhone && <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{t('Phone:', 'ಫೋನ್:')}</span> {listing.contactPhone}</p>}
                </div>

                {listing.description && (
                  <p className={`text-sm border-t pt-3 ${isDark ? 'text-gray-300 border-slate-700' : 'text-gray-600 border-gray-100'}`}>{listing.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openConversation(listing, false)}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {t('Message', 'ಸಂದೇಶ')}
                  </button>
                  <button
                    onClick={() => openConversation(listing, true)}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    {t('Contact Seller', 'ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಿ')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('Add Service', 'ಸೇವೆ ಸೇರಿಸಿ')}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {t('Adding under:', 'ಕೆಳಗೆ ಸೇರಿಸಲಾಗುತ್ತಿದೆ:')} <span className="font-semibold text-gray-900">{title}</span>
            </p>

            <form onSubmit={handleCreateListing} className="space-y-3">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <input
                required
                type="text"
                placeholder={t('Title', 'ಶೀರ್ಷಿಕೆ')}
                value={formData.title}
                onChange={(e) => setFormData((v) => ({ ...v, title: e.target.value }))}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  value={activeBlock.createCategory}
                  readOnly
                  className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900"
                />
                <select
                  required
                  value={formData.listingType}
                  onChange={(e) => setFormData((v) => ({ ...v, listingType: e.target.value }))}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900"
                >
                  {LISTING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder={t('Subcategory (optional)', 'ಉಪವರ್ಗ (ಐಚ್ಛಿಕ)')}
                  value={formData.subcategory}
                  onChange={(e) => setFormData((v) => ({ ...v, subcategory: e.target.value }))}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500"
                />
                <input
                  required
                  type="number"
                  min="1"
                  placeholder={t('Price', 'ಬೆಲೆ')}
                  value={formData.price}
                  onChange={(e) => setFormData((v) => ({ ...v, price: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData((v) => ({ ...v, unit: e.target.value }))}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900"
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input
                  type="number"
                  min="0"
                  placeholder={t('Quantity (optional)', 'ಪ್ರಮಾಣ (ಐಚ್ಛಿಕ)')}
                  value={formData.quantity}
                  onChange={(e) => setFormData((v) => ({ ...v, quantity: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500"
                />
              </div>

              <input
                required
                type="text"
                placeholder={t('Location', 'ಸ್ಥಳ')}
                value={formData.location}
                onChange={(e) => setFormData((v) => ({ ...v, location: e.target.value }))}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500"
              />

              <input
                type="text"
                placeholder={t('Contact phone (optional)', 'ಸಂಪರ್ಕ ಫೋನ್ (ಐಚ್ಛಿಕ)')}
                value={formData.contactPhone}
                onChange={(e) => setFormData((v) => ({ ...v, contactPhone: e.target.value }))}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500"
              />

              <textarea
                rows={3}
                placeholder={t('Description', 'ವಿವರಣೆ')}
                value={formData.description}
                onChange={(e) => setFormData((v) => ({ ...v, description: e.target.value }))}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500"
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setFormError('')
                  }}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-700"
                >
                  {t('Cancel', 'ರದ್ದುಮಾಡಿ')}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
                >
                  {t('Add Service', 'ಸೇವೆ ಸೇರಿಸಿ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
