import { Suspense } from 'react'
import AuthPageClient from './AuthPageClient'

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#0f0c0a_0%,#15100d_55%,#143327_100%)] px-4 py-16">
      <Suspense fallback={<div className="mx-auto w-full max-w-lg text-sm text-[#c8bca9]">Loading auth...</div>}>
        <AuthPageClient />
      </Suspense>
    </main>
  )
}
