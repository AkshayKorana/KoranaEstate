"use client"

import { useLanguage } from '@/app/language-context'

export default function Hero() {
  const { t } = useLanguage()

  return (
    <section className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-10 text-white shadow-lg">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('Coffee Marketplace', 'ಕಾಫಿ ಮಾರುಕಟ್ಟೆ')}</h1>
        <p className="mt-3 max-w-2xl text-white/90">
          {t('Track prices, compare commodities, and make better trading decisions.', 'ಬೆಲೆಗಳನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ, ವಸ್ತುಗಳನ್ನು ಹೋಲಿಸಿ ಮತ್ತು ಉತ್ತಮ ವ್ಯಾಪಾರ ನಿರ್ಧಾರಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ.')}
        </p>
      </div>
    </section>
  )
}
