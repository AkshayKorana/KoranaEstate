"use client"

import Image from 'next/image'
import { useLanguage } from '@/app/language-context'
import { useEffectiveTheme } from '@/app/theme-context'

export default function Hero() {
  const { t } = useLanguage()
  const { isDark } = useEffectiveTheme()

  return (
    <section className={`hero-parallax section-reveal relative overflow-hidden rounded-3xl border px-6 py-16 sm:px-10 ${
      isDark
        ? 'border-emerald-200/20 text-[#f4ead8] shadow-[0_30px_72px_rgba(8,12,10,0.56)]'
        : 'border-black/10 text-[#1a1a1a] shadow-[0_20px_44px_rgba(0,0,0,0.1)]'
    }`}>
      <div className="absolute inset-0">
        <div className="hero-bg-fade absolute inset-0">
          <Image
            src="/hero/coffee-cherries.jpg"
            alt=""
            fill
            priority
            className={`object-cover object-center ${isDark ? 'hero-bg-image' : 'hero-bg-image-light'}`}
            sizes="100vw"
          />
        </div>
        {isDark ? (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(8,7,6,0.74)_0%,rgba(14,12,10,0.66)_40%,rgba(12,11,10,0.74)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(125deg,rgba(11,29,21,0.58)_0%,rgba(14,38,28,0.46)_55%,rgba(11,29,21,0.56)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.56)_100%)]" />
            <div className="absolute inset-0 hero-grain opacity-25" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(47,107,79,0.08),transparent_60%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(245,239,230,0.16)_0%,rgba(245,239,230,0.3)_100%)]" />
          </>
        )}
      </div>

      <div className={`absolute inset-0 floating-particles ${isDark ? 'opacity-35' : 'opacity-20'}`} />
      <div className={`absolute inset-x-0 top-4 h-28 moving-light ${isDark ? '' : 'opacity-40'}`} />
      <div className={`absolute left-1/2 top-16 h-56 w-56 -translate-x-1/2 spotlight-halo ${isDark ? '' : 'opacity-45'}`} />
      <div className={`absolute -left-16 -top-16 h-44 w-44 rounded-full ${isDark ? 'bg-[#d5a567]/15 blur-2xl' : 'bg-[#b89452]/10 blur-xl'}`} />
      <div className={`absolute -bottom-24 -right-10 h-56 w-56 rounded-full ${isDark ? 'bg-[#2f6b54]/45 blur-2xl' : 'bg-[#2f6b4f]/12 blur-xl'}`} />
      <div className={`absolute right-8 top-8 h-28 w-28 rounded-full ${isDark ? 'bg-[#6da98b]/18 blur-2xl' : 'bg-[#2f6b4f]/10 blur-xl'}`} />
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <div className={`inline-flex items-center rounded-full border px-6 py-2.5 text-sm font-semibold tracking-wide shadow-sm backdrop-blur ${
          isDark
            ? 'border-emerald-200/30 bg-emerald-200/10 text-[#e9dbc8]'
            : 'border-[#2f6b4f]/25 bg-white/55 text-[#1c2b22]'
        }`}>
          {t('Korana Estate', 'ಕೊರಾನಾ ಎಸ್ಟೇಟ್')}
        </div>
        <h1 className={`font-luxe mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl ${isDark ? '' : 'text-[#1c2b22]'}`}>
          {t('Where Coffee Meets Intelligence.', 'ಕಾಫಿ ಮತ್ತು ಬುದ್ಧಿವಂತಿಕೆ ಸೇರುವ ಸ್ಥಳ.')}
        </h1>
        <p className={`font-luxe mx-auto mt-2 max-w-4xl text-2xl font-semibold leading-relaxed sm:text-3xl ${isDark ? 'text-[#f2e5d3]' : 'text-[#1a1a1a]'}`}>
          {t('The Complete Coffee & Spice Ecosystem', 'ಸಂಪೂರ್ಣ ಕಾಫಿ ಮತ್ತು ಮಸಾಲೆ ಪರಿಸರ ವ್ಯವಸ್ಥೆ')}
        </p>
        <p className={`mx-auto mt-5 max-w-4xl text-lg leading-relaxed sm:text-2xl ${isDark ? 'text-[#e4d6c6]' : 'text-[#3e3e3e]'}`}>
          {t(
            'Marketplace. Estate Essentials. Premium Store. Intelligence — All in One.',
            'ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್. ಎಸ್ಟೇಟ್ ಅವಶ್ಯಕತೆಗಳು. ಪ್ರೀಮಿಯಂ ಸ್ಟೋರ್. ಇಂಟೆಲಿಜೆನ್ಸ್ — ಎಲ್ಲವೂ ಒಂದೇ ಸ್ಥಳದಲ್ಲಿ.'
          )}
        </p>
      </div>
    </section>
  )
}
