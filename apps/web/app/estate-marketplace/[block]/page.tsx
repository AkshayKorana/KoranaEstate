'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '@/app/language-context'
import { useEffectiveTheme } from '@/app/theme-context'
import { sendMarketplaceMessage } from '@/app/lib/send-marketplace-message'
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
  const { isDark } = useEffectiveTheme()
  const params = useParams<{ block: string }>()
  const router = useRouter()
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated: () => router.replace('/auth'),
  })
  const isAdmin = session?.user?.role === 'ADMIN'

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
    if (status !== 'authenticated') return
    void fetchListings()
  }, [status, fetchListings])

  useEffect(() => {
    if (!block) return
    setFormData((prev) => ({
      ...prev,
      category: block.createCategory,
      listingType: block.createType,
    }))
  }, [block])

  const title = useMemo(() => (block ? t(block.title, block.titleKn) : t('Service', 'ಸೇವೆ')), [block, t])

  if (status === 'loading') {
    return null
  }

  if (!block) {
    return (
      <div className={`min-h-screen pb-12 ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`}>
        <div className="max-w-4xl mx-auto px-6 md:px-8 lg:px-10">
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

    try {
      await sendMarketplaceMessage({
        recipientId: listing.sellerId,
        listingId: listing.id,
        listingName: `${listing.title} (${listing.category})`,
        kind: 'estate',
        action: withIntro ? 'contact' : 'message',
        router,
      })
    } catch {
      alert(t('Failed to connect with seller', 'ಮಾರಾಟಗಾರರನ್ನು ಸಂಪರ್ಕಿಸಲು ವಿಫಲವಾಗಿದೆ'))
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
    <div className={`min-h-screen pb-12 ${isDark ? 'bg-slate-950' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className={`font-luxe text-4xl font-bold ${isDark ? 'text-brand-spectrum' : 'text-[#1f1f1f]'}`}>{title}</h1>
            <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-[#4a4a4a]'}`}>{t('Browse listings and chat with the seller.', 'ಪಟ್ಟಿಗಳನ್ನು ನೋಡಿ ಮತ್ತು ಮಾರಾಟಗಾರರೊಂದಿಗೆ ಚಾಟ್ ಮಾಡಿ.')}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/estate-marketplace"
              className={`rounded-lg border px-4 py-2 text-sm font-semibold ${isDark ? 'border-slate-600 bg-slate-800 text-gray-200' : 'border-black/10 bg-white text-[#2f2f2f]'}`}
            >
              {t('Back', 'ಹಿಂತಿರುಗಿ')}
            </Link>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setFormError('')
                  setShowCreateModal(true)
                }}
                className="rounded-lg lux-btn-primary px-4 py-2 text-sm font-semibold"
              >
                {t('+ Add Service', '+ ಸೇವೆ ಸೇರಿಸಿ')}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className={`rounded-xl border p-6 ${isDark ? 'border-slate-700 bg-slate-900 text-gray-300' : 'border-black/10 bg-white text-[#4a4a4a]'}`}>{t('Loading services...', 'ಸೇವೆಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...')}</div>
        ) : listings.length === 0 ? (
          <div className={`rounded-xl border p-6 ${isDark ? 'border-slate-700 bg-slate-900 text-gray-300' : 'border-black/10 bg-white text-[#4a4a4a]'}`}>{t('No listings yet in this service.', 'ಈ ಸೇವೆಯಲ್ಲಿ ಇನ್ನೂ ಪಟ್ಟಿಗಳಿಲ್ಲ.')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((listing) => (
              <div key={listing.id} className={`rounded-2xl border p-5 shadow-sm space-y-3 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-black/10 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-bold text-lg leading-tight ${isDark ? 'text-gray-100' : 'text-[#1f1f1f]'}`}>{listing.title}</h3>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {listing.listingType}
                  </span>
                </div>

                <div className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-[#4a4a4a]'}`}>
                  {listing.subcategory && <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-[#2f2f2f]'}`}>{t('Sub:', 'ಉಪ:')}</span> {listing.subcategory}</p>}
                  <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-[#2f2f2f]'}`}>{t('Price:', 'ಬೆಲೆ:')}</span> ₹{listing.price.toLocaleString('en-IN')} / {listing.unit}</p>
                  {listing.quantity != null && <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-[#2f2f2f]'}`}>{t('Qty:', 'ಪ್ರಮಾಣ:')}</span> {listing.quantity}</p>}
                  <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-[#2f2f2f]'}`}>{t('Location:', 'ಸ್ಥಳ:')}</span> {listing.location}</p>
                  <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-[#2f2f2f]'}`}>{t('Seller:', 'ಮಾರಾಟಗಾರ:')}</span> {listing.seller?.name || listing.seller?.email || t('Seller', 'ಮಾರಾಟಗಾರ')}</p>
                  {listing.contactPhone && <p><span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-[#2f2f2f]'}`}>{t('Phone:', 'ಫೋನ್:')}</span> {listing.contactPhone}</p>}
                </div>

                {listing.description && (
                  <p className={`text-sm border-t pt-3 ${isDark ? 'text-gray-300 border-slate-700' : 'text-[#4a4a4a] border-black/10'}`}>{listing.description}</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openConversation(listing, false)}
                    className="rounded-xl lux-btn-secondary px-3 py-2 text-sm font-semibold"
                  >
                    {t('Message', 'ಸಂದೇಶ')}
                  </button>
                  <button
                    onClick={() => openConversation(listing, true)}
                    className="rounded-xl lux-btn-primary px-3 py-2 text-sm font-semibold"
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
          <div className={`w-full max-w-xl rounded-2xl border p-6 shadow-2xl ${isDark ? 'glass border-emerald-200/30' : 'bg-white border-black/10'}`}>
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-[#efe4d4]' : 'text-[#1f1f1f]'}`}>{t('Add Service', 'ಸೇವೆ ಸೇರಿಸಿ')}</h2>
            <p className={`text-sm mb-4 ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>
              {t('Adding under:', 'ಕೆಳಗೆ ಸೇರಿಸಲಾಗುತ್ತಿದೆ:')} <span className={`font-semibold ${isDark ? 'text-[#efe4d4]' : 'text-[#1f1f1f]'}`}>{title}</span>
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
                className="lux-input w-full rounded-xl px-3 py-2 placeholder:text-gray-500"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  value={activeBlock.createCategory}
                  readOnly
                  className="lux-input rounded-xl px-3 py-2"
                />
                <select
                  required
                  value={formData.listingType}
                  onChange={(e) => setFormData((v) => ({ ...v, listingType: e.target.value }))}
                  className="lux-input rounded-xl px-3 py-2"
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
                  className="lux-input rounded-xl px-3 py-2 placeholder:text-gray-500"
                />
                <input
                  required
                  type="number"
                  min="1"
                  placeholder={t('Price', 'ಬೆಲೆ')}
                  value={formData.price}
                  onChange={(e) => setFormData((v) => ({ ...v, price: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="lux-input rounded-xl px-3 py-2 placeholder:text-gray-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData((v) => ({ ...v, unit: e.target.value }))}
                  className="lux-input rounded-xl px-3 py-2"
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input
                  type="number"
                  min="0"
                  placeholder={t('Quantity (optional)', 'ಪ್ರಮಾಣ (ಐಚ್ಛಿಕ)')}
                  value={formData.quantity}
                  onChange={(e) => setFormData((v) => ({ ...v, quantity: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="lux-input rounded-xl px-3 py-2 placeholder:text-gray-500"
                />
              </div>

              <input
                required
                type="text"
                placeholder={t('Location', 'ಸ್ಥಳ')}
                value={formData.location}
                onChange={(e) => setFormData((v) => ({ ...v, location: e.target.value }))}
                className="lux-input w-full rounded-xl px-3 py-2 placeholder:text-gray-500"
              />

              <input
                type="text"
                placeholder={t('Contact phone (optional)', 'ಸಂಪರ್ಕ ಫೋನ್ (ಐಚ್ಛಿಕ)')}
                value={formData.contactPhone}
                onChange={(e) => setFormData((v) => ({ ...v, contactPhone: e.target.value }))}
                className="lux-input w-full rounded-xl px-3 py-2 placeholder:text-gray-500"
              />

              <textarea
                rows={3}
                placeholder={t('Description', 'ವಿವರಣೆ')}
                value={formData.description}
                onChange={(e) => setFormData((v) => ({ ...v, description: e.target.value }))}
                className="lux-input w-full rounded-xl px-3 py-2 placeholder:text-gray-500"
              />

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setFormError('')
                  }}
                  className={`flex-1 rounded-xl border px-4 py-2 font-semibold ${isDark ? 'border-emerald-200/30 text-[#d8c8b3]' : 'border-black/10 text-[#2f2f2f]'}`}
                >
                  {t('Cancel', 'ರದ್ದುಮಾಡಿ')}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl lux-btn-primary px-4 py-2 font-semibold"
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
