import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/app/language-context'

interface LoginFormProps {
  onForgotPassword?: () => void
}

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const callbackUrl = searchParams.get('callbackUrl') || '/'
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      })

      setIsLoading(false)

      if (!result || result.error) {
        setError(t('Invalid email or password.', 'ಇಮೇಲ್ ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ತಪ್ಪಾಗಿದೆ.'))
        return
      }

      router.push(result.url || callbackUrl)
    } catch {
      setIsLoading(false)
      setError(t('Sign in failed. Please try again.', 'ಸೈನ್ ಇನ್ ವಿಫಲವಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-[#2f2f2f] dark:text-[#dbcdbb]">{t('Email', 'ಇಮೇಲ್')}</label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="lux-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
          placeholder={t('you@example.com', 'you@example.com')}
        />
      </div>

      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-[#2f2f2f] dark:text-[#dbcdbb]">{t('Password', 'ಪಾಸ್‌ವರ್ಡ್')}</label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="lux-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
          placeholder="••••••••"
        />
      </div>

      <button
        type="button"
        onClick={onForgotPassword}
        className="lux-btn-ghost text-sm font-medium"
      >
        {t('Forgot password?', 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರುವಿರಾ?')}
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="lux-btn-primary w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? t('Signing in...', 'ಸೈನ್ ಇನ್ ಆಗುತ್ತಿದೆ...') : t('Sign In', 'ಸೈನ್ ಇನ್')}
      </button>
    </form>
  )
}
