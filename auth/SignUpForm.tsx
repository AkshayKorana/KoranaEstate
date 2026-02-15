import { FormEvent, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SignUpForm() {
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
        setError(signupData?.error || 'Signup failed.')
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
        setError('Account created, but automatic sign in failed. Please sign in manually.')
        return
      }

      router.push(loginResult.url || '/')
    } catch {
      setIsLoading(false)
      setError('Signup failed. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Full Name</label>
        <input
          id="signup-name"
          type="text"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-emerald-500 focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          placeholder="Akshay Korana"
        />
      </div>

      <div>
        <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email</label>
        <input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-emerald-500 focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Password</label>
        <input
          id="signup-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-emerald-500 focus:ring-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          placeholder="At least 8 characters"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Creating account...' : 'Create Account'}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
