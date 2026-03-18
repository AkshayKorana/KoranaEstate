import { Suspense } from 'react'
import HomeStaysClient from './HomeStaysClient'

const HOME_STAYS_ENABLED = false

export default function HomeStaysPage() {
  if (!HOME_STAYS_ENABLED) {
    return null
  }

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <HomeStaysClient />
    </Suspense>
  )
}
