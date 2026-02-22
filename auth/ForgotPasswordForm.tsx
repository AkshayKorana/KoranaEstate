import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/app/language-context'

interface ForgotPasswordFormProps {
  onCancel: () => void
}

export default function ForgotPasswordForm({ onCancel }: ForgotPasswordFormProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccessful, setIsSuccessful] = useState(false)
  const [error, setError] = useState('')
  const [resetToken, setResetToken] = useState('')

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

      if (data?.resetToken) {
        setResetToken(data.resetToken)
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
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('Check your email', 'ನಿಮ್ಮ ಇಮೇಲ್ ಪರಿಶೀಲಿಸಿ')}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('We sent a password reset link to', 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸುವ ಲಿಂಕ್ ಕಳುಹಿಸಲಾಗಿದೆ')} <span className="font-medium">{email}</span>
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => router.push(`/auth?tab=reset-password${resetToken ? `&token=${resetToken}` : ''}`)}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {t('Continue to Reset Password', 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಲು ಮುಂದುವರಿಸಿ')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {t('Back to login', 'ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleResetPassword} className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('Reset your password', 'ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಿ')}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('Enter your email and we will send a reset link.', 'ನಿಮ್ಮ ಇಮೇಲ್ ನಮೂದಿಸಿ; ಮರುಹೊಂದಿಸುವ ಲಿಂಕ್ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.')}
        </p>
      </div>

      <div>
        <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">{t('Email', 'ಇಮೇಲ್')}</label>
        <input
          id="forgot-email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-emerald-500 focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          placeholder={t('you@example.com', 'you@example.com')}
        />
      </div>

      <div className="space-y-2">
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
          {isLoading ? t('Sending...', 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...') : t('Send reset link', 'ಮರುಹೊಂದಿಸುವ ಲಿಂಕ್ ಕಳುಹಿಸಿ')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {t('Back to login', 'ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ')}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
