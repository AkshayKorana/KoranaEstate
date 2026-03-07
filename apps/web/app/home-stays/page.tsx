import { Suspense } from 'react'
import HomeStaysClient from './HomeStaysClient'

export default function HomeStaysPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <HomeStaysClient />
    </Suspense>
  )
}
