'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '../language-context'
import AuthCard from '../../auth/AuthCard'
import LoginForm from '../../auth/LoginForm'
import SignUpForm from '../../auth/SignUpForm'

export default function AuthPageClient() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') ?? 'login'

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link href="/" className="text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300">
        ← {t('Back to home', 'ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ')}
      </Link>

      <div className="mt-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-200">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-8 w-8" aria-hidden="true">
            <path d="M3 8h12v5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Z" />
            <path d="M15 10h2a3 3 0 0 1 0 6h-2" />
            <path d="M7 3h2" />
            <path d="M11 3h2" />
          </svg>
        </div>

        <h1 className="text-3xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t('Welcome to Korana Estate', 'ಕೊರಾನಾ ಎಸ್ಟೇಟ್‌ಗೆ ಸ್ವಾಗತ')}
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-lg md:text-2xl text-slate-600 dark:text-slate-300">
          {t(
            'Your marketplace for coffee plantation products and services',
            'ಕಾಫಿ ತೋಟದ ಉತ್ಪನ್ನಗಳು ಮತ್ತು ಸೇವೆಗಳಿಗಾಗಿ ನಿಮ್ಮ ಮಾರುಕಟ್ಟೆ'
          )}
        </p>
      </div>

      <AuthCard
        key={tab}
        defaultTab={tab}
        loginForm={<LoginForm />}
        signupForm={<SignUpForm />}
      />
    </div>
  )
}
