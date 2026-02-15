import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface ResetPasswordFormProps {
  onSuccess: () => void
}

export default function ResetPasswordForm({ onSuccess }: ResetPasswordFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    const token = searchParams.get('token') || ''
    if (!token) {
      setError('Missing reset token. Please restart the forgot-password flow.')
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
        setError(data?.error || 'Failed to reset password.')
        return
      }

      onSuccess()
      router.push('/auth?tab=login')
    } catch {
      setIsLoading(false)
      setError('Failed to reset password. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Set a new password</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Enter and confirm your new password.</p>
      </div>

      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">New password</label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-emerald-500 focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Confirm password</label>
        <input
          id="confirm-password"
          type="password"
          required
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-emerald-500 focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Updating...' : 'Update password'}
      </button>
    </form>
  )
}
