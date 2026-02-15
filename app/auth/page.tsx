import { Suspense } from 'react'
import AuthPageClient from './AuthPageClient'

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-16 dark:from-gray-900 dark:to-gray-950">
      <Suspense fallback={<div className="mx-auto w-full max-w-lg text-sm text-gray-600">Loading auth...</div>}>
        <AuthPageClient />
      </Suspense>
    </main>
  )
}
