import { Suspense } from 'react'
import AuthPageClient from './AuthPageClient'

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#f5efe6_0%,#ebe2d3_60%,#e8efe8_100%)] px-4 py-16 dark:bg-[linear-gradient(145deg,#0f0c0a_0%,#15100d_55%,#143327_100%)]">
      <Suspense fallback={<div className="mx-auto w-full max-w-lg text-sm text-[#4a4a4a] dark:text-[#c8bca9]">Loading auth...</div>}>
        <AuthPageClient />
      </Suspense>
    </main>
  )
}
