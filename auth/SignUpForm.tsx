import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/app/language-context'

export default function SignUpForm() {
  const { t } = useLanguage()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: normalizedEmail, password }),
      })

      const signupData = await signupResponse.json()
      if (!signupResponse.ok) {
        const detail = typeof signupData?.detail === 'string' ? ` ${signupData.detail}` : ''
        setError((signupData?.error || t('Signup failed.', 'ಸೈನ್ ಅಪ್ ವಿಫಲವಾಗಿದೆ.')) + detail)
        setIsLoading(false)
        return
      }

      const loginResult = await signIn('credentials', {
        email: normalizedEmail,
        password,
        redirect: false,
        callbackUrl: '/',
      })

      setIsLoading(false)
      if (!loginResult || loginResult.error) {
        setError(t('Account created, but automatic sign in failed. Please sign in manually.', 'ಖಾತೆ ಸೃಷ್ಟಿಯಾಯಿತು, ಆದರೆ ಸ್ವಯಂ ಸೈನ್ ಇನ್ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಕೈಯಾರೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.'))
        return
      }

      router.push(loginResult.url || '/')
    } catch {
      setIsLoading(false)
      setError(t('Signup failed. Please try again.', 'ಸೈನ್ ಅಪ್ ವಿಫಲವಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="signup-name" className="block text-sm font-medium text-[#2f2f2f] dark:text-[#dbcdbb]">{t('Full Name', 'ಪೂರ್ಣ ಹೆಸರು')}</label>
        <input
          id="signup-name"
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="lux-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
          placeholder={t('Akshay Korana', 'ಅಕ್ಷಯ್ ಕೊರಾನಾ')}
        />
      </div>

      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-[#2f2f2f] dark:text-[#dbcdbb]">{t('Email', 'ಇಮೇಲ್')}</label>
        <input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="lux-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
          placeholder={t('you@example.com', 'you@example.com')}
        />
      </div>

      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium text-[#2f2f2f] dark:text-[#dbcdbb]">{t('Password', 'ಪಾಸ್‌ವರ್ಡ್')}</label>
        <input
          id="signup-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="lux-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
          placeholder={t('At least 8 characters', 'ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳು')}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="lux-btn-primary w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? t('Creating account...', 'ಖಾತೆ ಸೃಷ್ಟಿಯಾಗುತ್ತಿದೆ...') : t('Create Account', 'ಖಾತೆ ಸೃಷ್ಟಿಸಿ')}
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    </form>
  )
}
