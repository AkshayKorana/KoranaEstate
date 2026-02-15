import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

interface LoginFormProps {
  onForgotPassword?: () => void
}

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
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
        setError('Invalid email or password.')
        return
      }

      router.push(result.url || callbackUrl)
    } catch {
      setIsLoading(false)
      setError('Sign in failed. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-emerald-500 focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Password</label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-emerald-500 focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          placeholder="••••••••"
        />
      </div>

      <button
        type="button"
        onClick={onForgotPassword}
        className="text-sm font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        Forgot password?
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
