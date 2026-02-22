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
          <h1 className="font-luxe text-4xl font-bold text-brand-spectrum">{t('Estate Essentials Marketplace', 'ಎಸ್ಟೇಟ್ ಅವಶ್ಯಕತೆಗಳ ಮಾರುಕಟ್ಟೆ')}</h1>
          <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-[#c8bca9]'}`}>{t('Select a block to open a dedicated service page.', 'ಪ್ರತ್ಯೇಕ ಸೇವಾ ಪುಟವನ್ನು ತೆರೆಯಲು ಒಂದು ವಿಭಾಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ.')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {ESTATE_BLOCKS.map((block) => {
            const count = counts.find((c) => c.slug === block.slug)?.count ?? 0
            return (
              <Link
                key={block.slug}
                href={`/estate-marketplace/${block.slug}`}
                className={`group rounded-2xl border p-3 text-left transition-all hover:shadow-md ${isDark ? 'border-slate-700 bg-slate-900' : 'border-emerald-200/25 bg-[#171411]/75'}`}
              >
                <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 via-white to-blue-50">
                  <Image
                    src={block.image}
                    alt={block.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="mt-3">
                  <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-[#efe4d4]'}`}>{t(block.title, block.titleKn)}</p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-300' : 'text-[#c8bca9]'}`}>{t(block.subtitle, block.subtitleKn)}</p>
                  <p className="text-xs text-emerald-700 mt-2 font-semibold">{count} {t('active listings', 'ಸಕ್ರಿಯ ಪಟ್ಟಿಗಳು')}</p>
                </div>
                <div className="mt-3 rounded-lg gradient-brand-spectrum px-3 py-2 text-center text-xs font-semibold text-white">
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
