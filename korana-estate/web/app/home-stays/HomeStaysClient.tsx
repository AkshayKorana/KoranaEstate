'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { HomeStay } from '@/types/marketplace'
import { useLanguage } from '@/app/language-context'
import { useEffectiveTheme } from '@/app/theme-context'

const HOME_STAY_PLACEHOLDER =
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1400&q=80'

type HomeStayApiShape = HomeStay & {
  ownerId?: string
  owner?: { id: string; fullName?: string | null; email?: string | null } | null
}

function normalizeHomeStay(homeStay: HomeStayApiShape): HomeStay {
  return {
    id: homeStay.id,
    title: homeStay.title,
    name: homeStay.name,
    location: homeStay.location,
    pricePerNight: Number(homeStay.pricePerNight) || 0,
    description: homeStay.description,
    imageUrl: homeStay.imageUrl,
    imageUrls: homeStay.imageUrls,
    amenities: homeStay.amenities,
    maxGuests: homeStay.maxGuests,
    bedrooms: homeStay.bedrooms,
    bathrooms: homeStay.bathrooms,
    hostId: homeStay.hostId || homeStay.ownerId || homeStay.owner?.id || null,
    host: homeStay.host || (homeStay.owner
      ? { id: homeStay.owner.id, name: homeStay.owner.fullName, email: homeStay.owner.email || null }
      : null),
    createdAt: homeStay.createdAt,
    updatedAt: homeStay.updatedAt,
  }
}

function resolveImage(homeStay: HomeStay) {
  const firstGallery = Array.isArray(homeStay.imageUrls) ? homeStay.imageUrls.find(Boolean) : null
  return firstGallery || homeStay.imageUrl || HOME_STAY_PLACEHOLDER
}

export default function HomeStaysClient() {
  const { t } = useLanguage()
  const { isDark } = useEffectiveTheme()
  const [homeStays, setHomeStays] = useState<HomeStay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [maxPrice, setMaxPrice] = useState<number>(20000)
  const [guests, setGuests] = useState<number>(1)

  useEffect(() => {
    let mounted = true

    const loadHomeStays = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetch('/api/home-stays', { cache: 'no-store' })
        const payloadText = await res.text()
        let payload: unknown = []
        try {
          payload = payloadText ? JSON.parse(payloadText) : []
        } catch {
          payload = []
        }

        if (!res.ok) {
          const message =
            (payload as { message?: string })?.message || payloadText || `Failed to load home stays (HTTP ${res.status})`
          throw new Error(message)
        }

        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { items?: unknown[] })?.items)
            ? ((payload as { items?: unknown[] }).items ?? [])
            : []

        if (mounted) {
          setHomeStays((rows as HomeStayApiShape[]).map(normalizeHomeStay))
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : t('Failed to load home stays.', 'ಹೋಂ ಸ್ಟೇಸ್ ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ.'))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadHomeStays()
    return () => {
      mounted = false
    }
  }, [t])

  const filteredHomeStays = useMemo(() => {
    return homeStays.filter((stay) => {
      const locationMatch = locationFilter
        ? stay.location.toLowerCase().includes(locationFilter.toLowerCase())
        : true
      const priceMatch = stay.pricePerNight <= maxPrice
      const guestsMatch = stay.maxGuests ? stay.maxGuests >= guests : true
      return locationMatch && priceMatch && guestsMatch
    })
  }, [homeStays, locationFilter, maxPrice, guests])

  return (
    <div className={`min-h-screen pb-12 ${isDark ? 'bg-slate-950' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
        <div className="mb-8 slide-in-up">
          <h1 className={`font-luxe text-5xl font-bold ${isDark ? 'text-brand-spectrum' : 'text-[#1f2b24]'}`}>
            {t('Home Stays', 'ಹೋಂ ಸ್ಟೇಸ್')}
          </h1>
          <p className={`mt-2 text-lg ${isDark ? 'text-[#c8bca9]' : 'text-[#4a4a4a]'}`}>
            {t('Find estate homes and farm stays for your next trip.', 'ನಿಮ್ಮ ಮುಂದಿನ ಪ್ರಯಾಣಕ್ಕೆ ಎಸ್ಟೇಟ್ ಮತ್ತು ಫಾರ್ಮ್ ಸ್ಟೇಗಳನ್ನು ಹುಡುಕಿ.')}
          </p>
        </div>

        <div className={`mb-6 rounded-2xl border p-5 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-black/10 bg-white'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={`mb-2 block text-sm font-semibold ${isDark ? 'text-[#dbcdbb]' : 'text-[#2f2f2f]'}`}>
                {t('Location', 'ಸ್ಥಳ')}
              </label>
              <input
                type="text"
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                placeholder={t('Search by city/region', 'ನಗರ/ಪ್ರದೇಶದಿಂದ ಹುಡುಕಿ')}
                className="lux-input w-full rounded-xl px-4 py-3"
              />
            </div>
            <div>
              <label className={`mb-2 block text-sm font-semibold ${isDark ? 'text-[#dbcdbb]' : 'text-[#2f2f2f]'}`}>
                {t('Max Price (₹/night)', 'ಗರಿಷ್ಠ ಬೆಲೆ (₹/ರಾತ್ರಿ)')}
              </label>
              <input
                type="number"
                min={500}
                step={500}
                value={maxPrice}
                onChange={(event) => setMaxPrice(Number(event.target.value) || 0)}
                className="lux-input w-full rounded-xl px-4 py-3"
              />
            </div>
            <div>
              <label className={`mb-2 block text-sm font-semibold ${isDark ? 'text-[#dbcdbb]' : 'text-[#2f2f2f]'}`}>
                {t('Guests', 'ಅತಿಥಿಗಳು')}
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={guests}
                onChange={(event) => setGuests(Math.max(1, Number(event.target.value) || 1))}
                className="lux-input w-full rounded-xl px-4 py-3"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className={`rounded-2xl border p-6 ${isDark ? 'border-slate-700 bg-slate-900 text-gray-300' : 'border-black/10 bg-white text-[#4a4a4a]'}`}>
            {t('Loading home stays...', 'ಹೋಂ ಸ್ಟೇಸ್ ಲೋಡ್ ಆಗುತ್ತಿವೆ...')}
          </div>
        ) : filteredHomeStays.length === 0 ? (
          <div className={`rounded-2xl border p-6 ${isDark ? 'border-slate-700 bg-slate-900 text-gray-300' : 'border-black/10 bg-white text-[#4a4a4a]'}`}>
            {t('No home stays match these filters.', 'ಈ ಫಿಲ್ಟರ್‌ಗಳಿಗೆ ಹೊಂದುವ ಹೋಂ ಸ್ಟೇಸ್ ಇಲ್ಲ.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredHomeStays.map((stay) => (
              <article
                key={stay.id}
                className={`overflow-hidden rounded-2xl border shadow-sm transition-transform duration-300 hover:-translate-y-1 ${
                  isDark ? 'border-slate-700 bg-slate-900' : 'border-black/10 bg-white'
                }`}
              >
                <div className="relative h-52">
                  <Image
                    src={resolveImage(stay)}
                    alt={stay.title || stay.name || 'Home stay'}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="space-y-3 p-5">
                  <div>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-[#1f1f1f]'}`}>
                      {stay.title || stay.name || t('Untitled Home Stay', 'ಶೀರ್ಷಿಕೆ ಇಲ್ಲದ ಹೋಂ ಸ್ಟೇ')}
                    </h2>
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-[#4a4a4a]'}`}>{stay.location}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                      ₹{stay.pricePerNight.toLocaleString('en-IN')} / {t('night', 'ರಾತ್ರಿ')}
                    </p>
                    <Link
                      href={`/home-stays/${stay.id}`}
                      className="rounded-xl lux-btn-primary px-4 py-2 text-sm font-semibold"
                    >
                      {t('View Details', 'ವಿವರಗಳನ್ನು ನೋಡಿ')}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
