"use client"

import { useLanguage } from '@/app/language-context'

export default function Hero() {
  const { t } = useLanguage()

  return (
    <section className="gradient-brand-spectrum relative overflow-hidden rounded-3xl border border-white/30 px-6 py-12 text-white shadow-[0_24px_56px_rgba(23,35,31,0.46)] sm:px-10">
      <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-24 -right-10 h-56 w-56 rounded-full bg-[#1b4f40]/50 blur-2xl" />
      <div className="absolute right-8 top-8 h-28 w-28 rounded-full bg-[#c4374f]/35 blur-2xl" />
      <div className="relative mx-auto max-w-5xl text-center">
        <div className="inline-flex items-center rounded-full border border-white/40 bg-white/14 px-6 py-2.5 text-sm font-semibold tracking-wide text-white shadow-sm backdrop-blur">
          {t('Premium Coffee and Spices Marketplace', 'ಪ್ರೀಮಿಯಂ ಕಾಫಿ ಮತ್ತು ಮಸಾಲೆ ಮಾರುಕಟ್ಟೆ')}
        </div>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
          {t("Kodagu's Finest Coffee and Spices Marketplace", 'ಕೊಡಗಿನ ಅತ್ಯುತ್ತಮ ಕಾಫಿ ಮತ್ತು ಮಸಾಲೆ ಮಾರುಕಟ್ಟೆ')}
        </h1>
        <p className="mx-auto mt-5 max-w-4xl text-lg leading-relaxed text-white/90 sm:text-2xl">
          {t(
            'Track daily coffee and spice prices, compare commodities, and make smarter trading decisions with confidence.',
            'ದೈನಂದಿನ ಕಾಫಿ ಮತ್ತು ಮಸಾಲೆ ಬೆಲೆಗಳನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ, ವಸ್ತುಗಳನ್ನು ಹೋಲಿಸಿ ಮತ್ತು ಆತ್ಮವಿಶ್ವಾಸದಿಂದ ಇನ್ನಷ್ಟು ಉತ್ತಮ ವ್ಯಾಪಾರ ನಿರ್ಧಾರಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ.'
          )}
        </p>
      </div>
    </section>
  )
}
