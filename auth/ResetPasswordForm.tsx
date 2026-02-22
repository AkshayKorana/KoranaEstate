import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/app/language-context'

interface ResetPasswordFormProps {
  onSuccess: () => void
}

export default function ResetPasswordForm({ onSuccess }: ResetPasswordFormProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError(t('Password must be at least 8 characters.', 'ಪಾಸ್‌ವರ್ಡ್ ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳಿರಬೇಕು.'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('Passwords do not match.', 'ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ.'))
      return
    }

    const token = searchParams.get('token') || ''
    if (!token) {
      setError(t('Missing reset token. Please restart the forgot-password flow.', 'ರೀಸೆಟ್ ಟೋಕನ್ ಕಾಣೆಯಾಗಿದೆ. ದಯವಿಟ್ಟು ಮರೆತ-ಪಾಸ್‌ವರ್ಡ್ ಪ್ರಕ್ರಿಯೆಯನ್ನು ಮರುಪ್ರಾರಂಭಿಸಿ.'))
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json()

      setIsLoading(false)
      if (!response.ok) {
        setError(data?.error || t('Failed to reset password.', 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಲು ವಿಫಲವಾಗಿದೆ.'))
        return
      }

      onSuccess()
      router.push('/auth?tab=login')
    } catch {
      setIsLoading(false)
      setError(t('Failed to reset password. Please try again.', 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಲು ವಿಫಲವಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-[#efe4d4]">{t('Set a new password', 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ ಹೊಂದಿಸಿ')}</h3>
        <p className="mt-2 text-sm text-[#c8bca9]">{t('Enter and confirm your new password.', 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ ಮತ್ತು ದೃಢೀಕರಿಸಿ.')}</p>
      </div>

      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-[#dbcdbb]">{t('New password', 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್')}</label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="lux-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-[#dbcdbb]">{t('Confirm password', 'ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ')}</label>
        <input
          id="confirm-password"
          type="password"
          required
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className="lux-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="lux-btn-primary w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? t('Updating...', 'ನವೀಕರಿಸಲಾಗುತ್ತಿದೆ...') : t('Update password', 'ಪಾಸ್‌ವರ್ಡ್ ನವೀಕರಿಸಿ')}
      </button>
    </form>
  )
}
