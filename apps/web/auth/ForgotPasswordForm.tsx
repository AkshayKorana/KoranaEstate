import { FormEvent, useState } from 'react'
import { useLanguage } from '@/app/language-context'

interface ForgotPasswordFormProps {
  onCancel: () => void
}

export default function ForgotPasswordForm({ onCancel }: ForgotPasswordFormProps) {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccessful, setIsSuccessful] = useState(false)
  const [error, setError] = useState('')

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email) return

    try {
      setIsLoading(true)
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await response.json()
      setIsLoading(false)

      if (!response.ok) {
        setError(data?.detail ? `${data?.error || t('Failed to process request.', 'ವಿನಂತಿಯನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ವಿಫಲವಾಗಿದೆ.')} (${data.detail})` : (data?.error || t('Failed to process request.', 'ವಿನಂತಿಯನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ವಿಫಲವಾಗಿದೆ.')))
        return
      }

      setIsSuccessful(true)
    } catch {
      setIsLoading(false)
      setError(t('Failed to process request. Please try again.', 'ವಿನಂತಿಯನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ವಿಫಲವಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'))
    }
  }

  if (isSuccessful) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        <h3 className="text-xl font-semibold text-[#1f1f1f] dark:text-[#efe4d4]">{t('Check your email', 'ನಿಮ್ಮ ಇಮೇಲ್ ಪರಿಶೀಲಿಸಿ')}</h3>
        <p className="text-sm text-[#4a4a4a] dark:text-[#c8bca9]">
          {t('A temporary password has been sent to', 'ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್ ಕಳುಹಿಸಲಾಗಿದೆ')} <span className="font-semibold text-[#1f1f1f] dark:text-[#efe4d4]">{email}</span>.
        </p>
        <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">{t('Use it to log in, then change your password from settings.', 'ಅದರಿಂದ ಲಾಗಿನ್ ಮಾಡಿ, ನಂತರ ಸೆಟ್ಟಿಂಗ್‌ಗಳಿಂದ ಪಾಸ್‌ವರ್ಡ್ ಬದಲಾಯಿಸಿ.')}</p>
        <button
          type="button"
          onClick={onCancel}
          className="lux-btn-primary w-full rounded-xl px-4 py-2 text-sm font-semibold"
        >
          {t('Back to login', 'ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleResetPassword} className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-[#1f1f1f] dark:text-[#efe4d4]">{t('Reset your password', 'ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಿ')}</h3>
        <p className="mt-2 text-sm text-[#4a4a4a] dark:text-[#c8bca9]">
          {t('Enter your email and we will send a temporary password.', 'ನಿಮ್ಮ ಇಮೇಲ್ ನಮೂದಿಸಿ; ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.')}
        </p>
      </div>

      <div>
        <label htmlFor="forgot-email" className="block text-sm font-medium text-[#2f2f2f] dark:text-[#dbcdbb]">{t('Email', 'ಇಮೇಲ್')}</label>
        <input
          id="forgot-email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="lux-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
          placeholder={t('you@example.com', 'you@example.com')}
        />
      </div>

      <div className="space-y-2">
      <button
        type="submit"
        disabled={isLoading}
        className="lux-btn-primary w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
          {isLoading ? t('Sending...', 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...') : t('Send temporary password', 'ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್ ಕಳುಹಿಸಿ')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="lux-btn-secondary w-full rounded-xl px-4 py-2 text-sm font-semibold"
        >
          {t('Back to login', 'ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ')}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    </form>
  )
}
