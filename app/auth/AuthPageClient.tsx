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
    <div className="mx-auto w-full max-w-lg">
      <Link href="/" className="text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300">
        ← {t('Back to home', 'ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ')}
      </Link>

      <AuthCard
        key={tab}
        defaultTab={tab}
        loginForm={<LoginForm />}
        signupForm={<SignUpForm />}
      />
    </div>
  )
}
