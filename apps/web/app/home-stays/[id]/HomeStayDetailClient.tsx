'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { HomeStay } from '@/types/marketplace'
import { useLanguage } from '@/app/language-context'
import { useEffectiveTheme } from '@/app/theme-context'
import { handleSessionExpired, readResponsePayload, toChatApiError } from '@/app/lib/chat-client'

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

function buildImages(homeStay: HomeStay) {
  const gallery = Array.isArray(homeStay.imageUrls) ? homeStay.imageUrls.filter(Boolean) : []
  if (gallery.length > 0) return gallery
  if (homeStay.imageUrl) return [homeStay.imageUrl]
  return [HOME_STAY_PLACEHOLDER]
}

export default function HomeStayDetailClient({ id }: { id: string }) {
  const { t } = useLanguage()
  const { isDark } = useEffectiveTheme()
  const router = useRouter()
  const { status } = useSession()
  const [homeStay, setHomeStay] = useState<HomeStay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedImage, setSelectedImage] = useState(0)
  const [contactBusy, setContactBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    const loadHomeStay = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetch(`/api/home-stays/${encodeURIComponent(id)}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payloadText = await res.text()
        let payload: unknown = null
        try {
          payload = payloadText ? JSON.parse(payloadText) : null
        } catch {
          payload = null
        }

        if (!res.ok || !payload) {
          const message =
            (payload as { message?: string })?.message || payloadText || `Failed to load listing (HTTP ${res.status})`
          throw new Error(message)
        }

        if (mounted) {
          setHomeStay(normalizeHomeStay(payload as HomeStayApiShape))
          setSelectedImage(0)
        }
      } catch (err) {
        if (!controller.signal.aborted && mounted) {
          setError(err instanceof Error ? err.message : t('Failed to load listing.', 'ಲಿಸ್ಟಿಂಗ್ ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ.'))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadHomeStay()
    return () => {
      mounted = false
      controller.abort()
    }
  }, [id, t])

  const images = homeStay ? buildImages(homeStay) : [HOME_STAY_PLACEHOLDER]
  const canContactHost = Boolean(homeStay?.hostId)

  async function handleContactHost() {
    if (!homeStay) return

    if (status !== 'authenticated') {
      router.push(`/auth?callbackUrl=${encodeURIComponent(`/home-stays/${homeStay.id}`)}`)
      return
    }

    if (!homeStay.hostId) {
      return
    }

    try {
      setContactBusy(true)
      const conversationsRes = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ participantId: homeStay.hostId }),
      })
      const conversationsPayload = await readResponsePayload<{
        id?: string
        conversation?: { id?: string }
      }>(conversationsRes)

      if (!conversationsRes.ok) {
        const chatError = toChatApiError(conversationsRes, conversationsPayload)
        if (await handleSessionExpired(chatError)) {
          return
        }
        throw new Error(chatError.message)
      }

      const conversationId =
        conversationsPayload.data?.id || conversationsPayload.data?.conversation?.id
      if (!conversationId) {
        throw new Error(t('Conversation could not be created.', 'ಸಂಭಾಷಣೆ ಸೃಷ್ಟಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.'))
      }

      const message = `Hi! I'm interested in staying at ${
        homeStay.title || homeStay.name || 'this home stay'
      } in ${homeStay.location}. Is it available for my dates?`

      const messageRes = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ conversationId, content: message }),
      })
      const messagePayload = await readResponsePayload(messageRes)

      if (!messageRes.ok) {
        const chatError = toChatApiError(messageRes, messagePayload)
        if (await handleSessionExpired(chatError)) {
          return
        }
        throw new Error(chatError.message)
      }

      router.push(`/messages?conversationId=${encodeURIComponent(conversationId)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to contact host.', 'ಹೋಸ್ಟ್ ಅನ್ನು ಸಂಪರ್ಕಿಸಲು ವಿಫಲವಾಗಿದೆ.'))
    } finally {
      setContactBusy(false)
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen pb-12 ${isDark ? 'bg-slate-950' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10">
          <div className={`rounded-2xl border p-6 ${isDark ? 'border-slate-700 bg-slate-900 text-gray-300' : 'border-black/10 bg-white text-[#4a4a4a]'}`}>
            {t('Loading home stay details...', 'ಹೋಂ ಸ್ಟೇ ವಿವರಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...')}
          </div>
        </div>
      </div>
    )
  }

  if (!homeStay) {
    return (
      <div className={`min-h-screen pb-12 ${isDark ? 'bg-slate-950' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-4">
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-red-100">
            {error || t('Home stay not found.', 'ಹೋಂ ಸ್ಟೇ ಕಂಡುಬಂದಿಲ್ಲ.')}
          </div>
          <Link href="/home-stays" className="rounded-xl lux-btn-secondary px-4 py-2 text-sm font-semibold">
            {t('Back to Home Stays', 'ಹೋಂ ಸ್ಟೇಸ್‌ಗೆ ಹಿಂತಿರುಗಿ')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen pb-12 ${isDark ? 'bg-slate-950' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className={`font-luxe text-4xl font-bold ${isDark ? 'text-brand-spectrum' : 'text-[#1f2b24]'}`}>
              {homeStay.title || homeStay.name || t('Home Stay', 'ಹೋಂ ಸ್ಟೇ')}
            </h1>
            <p className={`${isDark ? 'text-gray-300' : 'text-[#4a4a4a]'}`}>{homeStay.location}</p>
          </div>
          <Link href="/home-stays" className="rounded-xl lux-btn-secondary px-4 py-2 text-sm font-semibold">
            {t('Back', 'ಹಿಂತಿರುಗಿ')}
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="relative h-[360px] overflow-hidden rounded-2xl">
              <Image
                src={images[selectedImage] || HOME_STAY_PLACEHOLDER}
                alt={homeStay.title || homeStay.name || 'Home stay'}
                fill
                className="object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={`relative h-20 overflow-hidden rounded-xl border ${
                      index === selectedImage ? 'border-emerald-500' : isDark ? 'border-slate-700' : 'border-black/10'
                    }`}
                  >
                    <Image src={image} alt={`Home stay image ${index + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className={`rounded-2xl border p-5 space-y-4 h-fit ${isDark ? 'border-slate-700 bg-slate-900' : 'border-black/10 bg-white'}`}>
            <p className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
              ₹{homeStay.pricePerNight.toLocaleString('en-IN')} / {t('night', 'ರಾತ್ರಿ')}
            </p>
            <div className={`space-y-2 text-sm ${isDark ? 'text-gray-300' : 'text-[#4a4a4a]'}`}>
              {homeStay.maxGuests != null && <p>👥 {homeStay.maxGuests} {t('guests', 'ಅತಿಥಿಗಳು')}</p>}
              {homeStay.bedrooms != null && <p>🛏️ {homeStay.bedrooms} {t('bedrooms', 'ಬೆಡ್ ರೂಮ್‌ಗಳು')}</p>}
              {homeStay.bathrooms != null && <p>🛁 {homeStay.bathrooms} {t('bathrooms', 'ಬಾತ್ರೂಮ್‌ಗಳು')}</p>}
            </div>

            <button
              type="button"
              onClick={() => void handleContactHost()}
              disabled={contactBusy || !canContactHost}
              title={!canContactHost ? t('Host details unavailable', 'ಹೋಸ್ಟ್ ವಿವರಗಳು ಲಭ್ಯವಿಲ್ಲ') : ''}
              className="w-full rounded-xl lux-btn-primary px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {contactBusy ? t('Connecting...', 'ಸಂಪರ್ಕಿಸುತ್ತಿದೆ...') : t('Contact Host', 'ಹೋಸ್ಟ್ ಸಂಪರ್ಕಿಸಿ')}
            </button>
          </aside>
        </div>

        <section className={`rounded-2xl border p-5 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-black/10 bg-white'}`}>
          <h2 className={`mb-3 text-xl font-semibold ${isDark ? 'text-gray-100' : 'text-[#1f1f1f]'}`}>
            {t('About this stay', 'ಈ ವಾಸ್ತವ್ಯದ ಕುರಿತು')}
          </h2>
          <p className={`${isDark ? 'text-gray-300' : 'text-[#4a4a4a]'}`}>
            {homeStay.description || t('No description provided.', 'ವಿವರಣೆ ನೀಡಲಾಗಿಲ್ಲ.')}
          </p>
        </section>

        {Array.isArray(homeStay.amenities) && homeStay.amenities.length > 0 && (
          <section className={`rounded-2xl border p-5 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-black/10 bg-white'}`}>
            <h2 className={`mb-3 text-xl font-semibold ${isDark ? 'text-gray-100' : 'text-[#1f1f1f]'}`}>
              {t('Amenities', 'ಸೌಲಭ್ಯಗಳು')}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {homeStay.amenities.map((amenity) => (
                <li key={amenity} className={`${isDark ? 'text-gray-300' : 'text-[#4a4a4a]'}`}>• {amenity}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
