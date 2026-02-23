'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/app/components/Navbar'
import { useLanguage } from '@/app/language-context'
import { useTheme } from '@/app/theme-context'
import { ESTATE_BLOCKS, blockHasCategory } from './blocks'

type EstateListing = {
  id: string
  category: string
}

export default function EstateMarketplacePage() {
  const { t } = useLanguage()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [listings, setListings] = useState<EstateListing[]>([])

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const res = await fetch('/api/estate/listings?limit=500', { cache: 'no-store' })
        const data = await res.json()
        if (mounted) {
          setListings(Array.isArray(data?.listings) ? data.listings : [])
        }
      } catch {
        if (mounted) setListings([])
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  const counts = useMemo(() => {
    return ESTATE_BLOCKS.map((block) => ({
      slug: block.slug,
      count: listings.filter((listing) => blockHasCategory(block, listing.category)).length,
    }))
  }, [listings])

  return (
    <div className={`min-h-screen content-under-navbar pb-12 ${isDark ? 'bg-slate-950' : 'bg-transparent'}`}>
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-10 space-y-8">
        <div>
          <h1 className={`font-luxe text-4xl font-bold ${isDark ? 'text-brand-spectrum' : 'text-[#1f2b24]'}`}>{t('Estate Essentials Marketplace', 'ಎಸ್ಟೇಟ್ ಅವಶ್ಯಕತೆಗಳ ಮಾರುಕಟ್ಟೆ')}</h1>
          <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-[#4a4a4a]'}`}>{t('Select a block to open a dedicated service page.', 'ಪ್ರತ್ಯೇಕ ಸೇವಾ ಪುಟವನ್ನು ತೆರೆಯಲು ಒಂದು ವಿಭಾಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ.')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {ESTATE_BLOCKS.map((block) => {
            const count = counts.find((c) => c.slug === block.slug)?.count ?? 0
            return (
              <Link
                key={block.slug}
                href={`/estate-marketplace/${block.slug}`}
                className={`group rounded-3xl border p-3 text-left transition-all duration-300 ${
                  isDark
                    ? 'border-slate-700 bg-slate-900 hover:shadow-md'
                    : 'border-black/10 bg-[#fffdf9] shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(0,0,0,0.12)]'
                }`}
              >
                <div className={`relative aspect-[16/9] overflow-hidden rounded-2xl ${isDark ? 'bg-gradient-to-br from-emerald-50 via-white to-blue-50' : 'bg-gradient-to-br from-[#f8f3ea] via-white to-[#eef5f0]'}`}>
                  <Image
                    src={block.image}
                    alt={block.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                  />
                  {!isDark && (
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1f4d3a]/20 via-transparent to-transparent" />
                  )}
                </div>
                <div className="mt-3 px-1">
                  <p className={`text-base font-bold ${isDark ? 'text-gray-100' : 'text-[#1f2b24]'}`}>{t(block.title, block.titleKn)}</p>
                  <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-[#4a4a4a]'}`}>{t(block.subtitle, block.subtitleKn)}</p>
                  <div className="mt-3 inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {count} {t('active listings', 'ಸಕ್ರಿಯ ಪಟ್ಟಿಗಳು')}
                  </div>
                </div>
                <div className={`mt-4 rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition-all ${
                  isDark
                    ? 'bg-emerald-700 text-white'
                    : 'border border-[#2f6b4f]/30 bg-white text-[#1f4d3a] group-hover:bg-[#edf5f0]'
                }`}>
                  {t('Open', 'ತೆರೆಯಿರಿ')}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
